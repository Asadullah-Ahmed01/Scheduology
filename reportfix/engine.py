"""
ReportFix - AI text-understanding engine.

This module is the "AI half" of the split:
  - understands English + Roman Urdu + mixes, with typos,
  - extracts category/location/priority + a one-line reason,
  - detects safety hazards regardless of tone,
  - treats report text as DATA: instruction-like clauses are stripped and
    logged, never obeyed (prompt-injection defense),
  - asks for clarification when a place is not recognized.

The other half (trust math, voting weights, permissions, state machine,
crowd counting) lives in app.py as plain deterministic code - a report can
never change those by what it says.
"""

import re
from difflib import SequenceMatcher

# ---------------------------------------------------------------- lexicons
# category_key: {dept, label, base_priority, keywords}
#   dept: one of DEPARTMENTS or "ADMIN" (needs human triage)
#   priority: CRITICAL | HIGH | MEDIUM | LOW  (tone can never change this)
KEYWORDS = {
    "wifi": {
        "dept": "IS", "label": "WLAN / Internet down", "priority": "MEDIUM",
        "kw": ["wifi", "wi-fi", "wyfi", "waifi", "wify", "internet", "internt",
               "net chal", "net nahi", "net band", "network", "network down", "netwrk",
               "signal nahi", "bandwidth", "router", "lan down", "ping",
               "connectivity", "no net", "hotspot nahi"],
    },
    "projector": {
        "dept": "LABS", "label": "Projector not working", "priority": "MEDIUM",
        "kw": ["projector", "prohjector", "projctor", "proyector", "slide",
               "screen nahi", "projecter", "proyektar"],
    },
    "printer": {
        "dept": "LABS", "label": "Printer not working", "priority": "MEDIUM",
        "kw": ["printer kharab", "printer not", "printer nahi",
               "printer broken", "printer jam", "print out", "printout"],
    },
    "computer": {
        "dept": "LABS", "label": "Lab computer faulty", "priority": "MEDIUM",
        "kw": ["computer nahi", "pc nahi", "pc on nahi", "pc doesn't",
               "machine boot", "monitor nahi", "keyboard broken", "mouse toot",
               "computer kharab", "computer on nahi", "workstation"],
    },
    "lab-equipment": {
        "dept": "LABS", "label": "Lab equipment broken", "priority": "MEDIUM",
        "kw": ["microscope", "oscilloscope", "multimeter", " apparatus",
               "equipment kharab", "equipment broken", "machine kharab",
               "bench toot", "bench broken", "lab bench"],
    },
    "ac": {
        "dept": "EE", "label": "AC / cooling not working", "priority": "MEDIUM",
        "kw": ["ac kharab", "ac nahi", "ac not", "air condition", "aircondition",
               "air con", "cooling nahi", "garmi bohat", "bohat garmi",
               "too hot", "heat nahi", "ac band", "acs not working", "a c"],
    },
    "electricity": {
        "dept": "EE", "label": "Electricity / electrical supply", "priority": "HIGH",
        "kw": ["bijli", "bijli chali", "light nahi", "lights nahi", "lights out",
               "lights off", "no light", "light on nahi", "power cut", "power out",
               "powerchali", "power nahi", "load shedding", "fan nahi",
               "pankha", "pankhe", "fan not", "fan broken", "fan chal nahi", "pankha chal nahi", "socket", "switch bord",
               "switchboard", "wiring", "taar", "bulb", "tube light", "tubelight"],
    },
    "electrical-safety": {
        "dept": "EE", "label": "Electrical safety hazard", "priority": "CRITICAL",
        "safety": True,
        "kw": ["spark", "sparking", "sparks", "current aa", "shock",
               "jhataka", "jhatka", "short circuit", "shortcircuit", "lagta hai current",
               "taar se current", "wire se current", "circuit se aag"],
    },
    "fire": {
        "dept": "EE", "label": "Fire hazard", "priority": "CRITICAL",
        "safety": True,
        "kw": ["fire", "aag", "aag lag", "aag llag", "smoke", "smoke aa", "dhuan",
               "dhuann", "duaan", "duwaan", "burning", "jal raha", "jal gaya",
               "flammable", "catching fire"],
    },
    "gas": {
        "dept": "EE", "label": "Gas leak", "priority": "CRITICAL",
        "safety": True,
        "kw": ["gas leak", "gas ki smell", "gas smell", "gas aa rahi",
               "leaking gas", "smell of gas", "lpg", "gas ki boo"],
    },
    "medical": {
        "dept": "ADMIN", "label": "Medical emergency", "priority": "CRITICAL",
        "safety": True,
        "kw": ["injured", "injury", "bleeding", "khoon", "unconscious", "behosh",
               "fainted", "faint ho", "collapse", "breathing problem", "saans nahi",
               "heart attack", " fits ", "seizure", "first aid", "ambulance"],
    },
    "water": {
        "dept": "EE", "label": "Water / plumbing", "priority": "HIGH",
        "kw": ["paani nahi", "pani nahi", "pani band", "paani band", "no water", "water nahi", "tap broken",
               "tap toot", "leak", "leaking", "leakage", "pipe burst", "pipa",
               "sewerage", "sewer", "nali", "ganda paani", "overflow", "sink blocked",
               "washroom ka paani", "flush nahi"],
    },
    "food": {
        "dept": "CAFETERIA", "label": "Food quality / hygiene", "priority": "MEDIUM",
        "kw": ["khana kharab", "khana basi", "khana thanda", "khana mehnga", "khana saaf nahi",
               "stale food", "food poisoning", "food poisning", "bad food",
               "food quality", "keera nika", " cockroach", "insect in food",
               "baasi khana", "saaf nahi khana", "food stale", "roti kharab"],
    },
    "cleanliness": {
        "dept": "CAFETERIA", "label": "Cleanliness / waste", "priority": "MEDIUM",
        "kw": ["kachra", "gandagi", "garbage", "trash", "dirty", "safai nahi",
               "not clean", "smell aa", "badboo", "badbu", "toilet kharab",
               "washroom ganda", "washroom dirty", "clean nahi"],
    },
    "library": {
        "dept": "LIBRARY", "label": "Library service", "priority": "MEDIUM",
        "kw": ["kitab", "kitaab", "book nahi", "book issue", "library card",
               "seat nahi", "seats nahi", "reading hall", "librarian",
               "return nahi", "book return", "quiet nahi", "shor in library"],
    },
    "harassment": {
        "dept": "ADMIN", "label": "Harassment / ragging (confidential)",
        "priority": "HIGH", "confidential": True,
        "kw": ["harassment", "harass", " teased", "teasing me", "ragging",
               "ragging kar", "senior tang", "tang kar rahe", " bully", "bullying",
               "bullied", "dhamki", "threat", "threatening", "stalking", "stalk",
               "picha karta", ".registry se paisa", "paisa mange", "paisay mang",
               "touch kar", "chhu raha", "galian de", "gaali de", "abuse",
               " abusing", "blackmail"],
    },
    "classroom": {
        "dept": "ADMIN", "label": "Classroom / furniture", "priority": "LOW",
        "kw": ["kursi toot", "chair broken", "kursi broken", "desk broken",
               "desk toot", "whiteboard", "marker nahi", "board nahi likh",
               "chALK nahi", "duster nahi", "window toot", "darwaza kharab",
               "door broken", " benches kharaab"],
    },
}


def _normalize(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s\-/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _tok_sim(a, b):
    """Per-token similarity. Short tokens (<3 chars) must match exactly so
    'block b' can never fuzzy-become 'block a'."""
    if a == b:
        return 1.0
    if len(a) < 3 or len(b) < 3:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _fuzzy_in(haystack_tokens, phrase_tokens, thresh=0.78):
    """Does the token list contain the phrase, tolerating typos,
    token by token?"""
    n = len(phrase_tokens)
    if n == 0 or len(haystack_tokens) < n:
        return False
    for i in range(len(haystack_tokens) - n + 1):
        if all(_tok_sim(haystack_tokens[i + j], phrase_tokens[j]) >= thresh
               for j in range(n)):
            return True
    return False


# --------------------------------------------------------------- locations
# canonical -> list of textual aliases (fuzzy matched)
LOCATIONS = {
    "CSE Lab 1": ["cse lab 1", "cs lab 1", "cse lab one", "lab 1 cse", "computer lab 1"],
    "CSE Lab 2": ["cse lab 2", "cs lab 2", "cse lab two", "lab 2 cse", "computer lab 2"],
    "CSE Lab 3": ["cse lab 3", "cs lab 3", "cse lab teen", "lab 3 cse", "computer lab 3"],
    "CSE Lab 4": ["cse lab 4", "cs lab 4", "lab 4 cse", "computer lab 4"],
    "EE Lab 1": ["ee lab 1", "electrical lab 1", "ee lab one"],
    "EE Lab 2": ["ee lab 2", "electrical lab 2"],
    "Labs Complex 1": ["lab 1", "lab one", "lab no 1", "lab aik"],
    "Labs Complex 2": ["lab 2", "lab two", "lab no 2", "lab do"],
    "Labs Complex 3": ["lab 3", "lab three", "lab no 3", "lab teen"],
    "Labs Complex 4": ["lab 4", "lab four", "lab no 4", "lab char"],
    "Library": ["library", "libary", "librari", "libraray", "laibrary", "reading hall", "lib"],
    "Main Cafeteria": ["cafeteria", "cafe teria", "canteen", "canteen hall", "cafe", "khana khane", "mess"],
    "Auditorium": ["auditorium", "auditoriyam", "auditoriom", "main hall"],
    "Block A": ["block a", "block aye", "a block"],
    "Block B": ["block b", "b block"],
    "Room 101": ["room 101", "rum 101", "room no 101"],
    "Room 102": ["room 102", "rum 102", "room no 102"],
    "Room 103": ["room 103", "rum 103", "room no 103"],
    "Sports Ground": ["sports ground", "ground", "playground", "play ground", "maidan"],
    "Parking Lot": ["parking", "parking lot", "parking area"],
    "Campus Corridors": ["corridor", "corridors", "laher", "walkway"],
}
URDU_NUM = {"aik": "1", "ek": "1", "one": "1", "do": "2", "two": "2",
            "teen": "3", "three": "3", "char": "4", "chaar": "4", "four": "4"}


# ------------------------------------------------------ injection defense
# Directives aimed at the SYSTEM are stripped before analysis and flagged.
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(the\s+)?(previous|above|prior|earlier|old)\s+(rules?|instructions?|prompts?|text)",
    r"disregard\s+(all\s+)?(previous|prior|the)\s+\w+",
    r"ignore\s+your\s+(rules?|instructions?|programming)",
    r"mark\s+(this|it|that)?\s*(as|as a)?\s*(critical|urgent|high priority|top priority|emergency)",
    r"set\s+(the\s+)?(priority|urgency)\s+(to\s+)?(critical|urgent|high|top|maximum)",
    r"you\s+are\s+now\s+(an?\s+)?(admin|administrator|unrestricted|developer\s+mode)",
    r"system\s*[:,]\s",
    r"admin\s+(instructions?|orders?|says?|here)\s*[:,]?\s",
    r"treat\s+(this|it)\s+as\s+(an?\s+)?(critical|emergency|top\s+priority)\s+(issue|report|matter|complaint)",
    r"escalate\s+(this\s+)?(to\s+)?(critical|top|maximum|highest)",
    r"bypass\s+(the\s+)?(rules?|filters?|checks?|validation)",
    r"override\s+(the\s+)?(rules?|priority|routing|system|settings)",
    r"please\s+route\s+(this|it)\s+to\s+\w+\s+department",
    r"send\s+(this|it)\s+to\s+\w+\s+department\s+(immediately|instead)",
    r"please\s+mark\s+(this|it)\s+\w+",
    r"automatically\s+(mark|route|close|resolve|approve)\s+(this|it)",
    r"delivered\s+to\s+all\s+departments",
]


def sanitize(text):
    """Split into clauses; drop any clause that looks like a directive to the
    system, so it can never influence classification. Returns
    (clean_text, [flags])."""
    flags = []
    clauses = re.split(r"(?<=[.!?;])\s+|\n+|,\s+", text)
    kept = []
    for cl in clauses:
        norm = _normalize(cl)
        hit = None
        for pat in INJECTION_PATTERNS:
            if re.search(pat, norm):
                hit = pat
                break
        if hit:
            flags.append(cl.strip()[:120])
        else:
            kept.append(cl)
    return " ".join(kept), flags


# ------------------------------------------------------------ safety lexicon
SAFETY_TERMS = (
    [k for c in ("fire", "gas", "electrical-safety", "medical")
     for k in KEYWORDS[c]["kw"]] +
    ["fire lag", "aag llag gai", "smoke nika", "dhuan nikal", "explosion",
     "dhamaka", "blast", "building hil", "roof gir", "deewar gir", "collapse hua"]
)
# Tone words that must NOT change priority, but we detect them so we can
# honestly say we ignored them.
TONE_WORDS = ["urgent", "urgently", "asap", "jaldi", "jaldi se", "foran",
              "fori", "immediately", "emergency hai", "abhi", "turant"]


def _match_category(tokens):
    best = None
    best_score = 0.0
    for key, cfg in KEYWORDS.items():
        for phrase in cfg["kw"]:
            pt = phrase.split()
            if _fuzzy_in(tokens, pt, 0.78):
                score = len(pt) + (1 if cfg.get("safety") else 0)
                if score > best_score:
                    best_score = score
                    best = (key, phrase)
    return best


def _match_location(text_norm, tokens):
    """Return (canonical_location|None, suggestions[], exact_bool)."""
    m = re.search(r"\b(cse|cs|ee|electrical)?\s*lab\s*(\d+|one|two|three|four|aik|ek|do|teen|char|chaar)\b",
                  text_norm)
    if m:
        pre = (m.group(1) or "").strip()
        pre = {"cs": "cse", "electrical": "ee"}.get(pre, pre)
        num = URDU_NUM.get(m.group(2), m.group(2))
        if pre == "cse":
            return f"CSE Lab {num}", [], True
        if pre == "ee":
            return f"EE Lab {num}", [], True
        return None, [f"Labs Complex {num}"], False  # "lab 3" - which dept?
    m2 = re.search(r"\broom\s*(no\.?\s*)?(\d{2,4})\b", text_norm)
    if m2:
        room = f"Room {m2.group(2)}"
        if room in LOCATIONS:
            return room, [], True
        return None, [], False  # room number exists but not on campus map
    best = None
    best_score = 0.0
    for canon, aliases in LOCATIONS.items():
        for alias in aliases:
            at = alias.split()
            if _fuzzy_in(tokens, at, 0.78):
                score = len(at) + (0.5 if alias == canon.lower() else 0)
                if score > best_score:
                    best_score = score
                    best = canon
    if best:
        return best, [], True
    return None, [], False


def analyze(raw_text):
    """The main entry: raw student text -> routing decision dict."""
    clean, injection_flags = sanitize(raw_text)
    norm = _normalize(clean)
    tokens = norm.split()

    cat = _match_category(tokens)
    location, suggestions, exact_loc = _match_location(norm, tokens)

    # Safety sweep on the cleaned text (content words only, multilingual).
    safety_hit = any(_fuzzy_in(tokens, s.split(), 0.78) for s in SAFETY_TERMS)

    result = {}
    if cat is None:
        result.update(dept="ADMIN", category=None,
                      category_label="Unclassified (admin triage)",
                      priority="MEDIUM")
    else:
        key, _phrase = cat
        cfg = KEYWORDS[key]
        result["category"] = key
        result["category_label"] = cfg["label"]
        result["dept"] = cfg["dept"]
        result["confidential"] = bool(cfg.get("confidential"))
        result["priority"] = cfg["priority"]
        if cfg.get("safety"):
            result["safety"] = True

    if safety_hit and result.get("priority") != "CRITICAL":
        result["priority"] = "CRITICAL"
        result["safety"] = True

    # Tone words are deliberately NOT used for priority (rule 3).
    tone_ignored = [w for w in TONE_WORDS if _fuzzy_in(tokens, w.split(), 0.85)]
    shouting = raw_text.isupper() and len(raw_text.strip()) >= 8

    # Location rule 6: no guessing.
    if location:
        result["location"] = location
        result["needs_clarification"] = False
    elif suggestions:
        result["location"] = None
        result["needs_clarification"] = True
        result["location_hint"] = f"which lab did you mean?"
        result["suggestions"] = suggestions
    else:
        result["location"] = None
        result["needs_clarification"] = True
        result["location_hint"] = (
            "We could not find that place on campus. Please pick the correct "
            "location so we do not route your report to the wrong department.")
        result["suggestions"] = []

    # One-line human-readable reason.
    parts = []
    parts.append(f"Understood as: {result['category_label']}"
                 if cat else "Could not classify confidently; sent to admin")
    parts.append(f"safety rule -> CRITICAL (tone ignored)" if safety_hit else
                 f"priority {result['priority']} (from problem type, not tone)")
    if result.get("location"):
        parts.append(f"location: {result['location']}")
    elif not result["needs_clarification"] and not suggestions:
        parts.append("location: unknown")
    if injection_flags:
        parts.append(f"{len(injection_flags)} instruction-like clause(s) ignored")
    if tone_ignored or shouting:
        parts.append("shouting/urgent words did not change priority")
    result["reason"] = ". ".join(parts) + "."
    result["injection_flags"] = injection_flags
    return result
