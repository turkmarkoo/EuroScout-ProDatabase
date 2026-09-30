"""Build the current EuroCup roster pack from Euroleague Basketball's public feed."""

from __future__ import annotations

import json
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API = "https://api-live.euroleague.net/v2/competitions/U/seasons/U2026"
SOURCE = "https://www.euroleaguebasketball.net/en/eurocup/teams/"
UA = "Mozilla/5.0 (compatible; EuroScoutRosterSync/1.0)"

# The app already has canonical club keys from domestic and international packs.
# Keep those identities instead of creating a second club for the EuroCup entry.
TEAM_KEYS = {
    "ARI": "gbl|ARI",
    "TRT": "lba|BDBT",
    "BAH": "eurocup|BAH",
    "BLK": "n2627|BB9",
    "BOS": "aba|BOS",
    "BUD": "eurocup|BUD",
    "LJU": "eurocup|LJU",
    "BOU": "eurocup|BOU",
    "TRN": "eurocup|TRN",
    "JER": "eurocup|JER",
    "MAN": "eurocup|MAN",
    "TNF": "acb|LLT",
    "LEM": "lnb|LEM",
    "LKB": "eurocup|LKB",
    "LLI": "eurocup|LLI",
    "MRO": "n2627|MR",
    "NAP": "lba|PZZ",
    "KLA": "eurocup|KLA",
    "NIN": "eurocup|NIN",
    "PAO": "gbl|PAOK",
    "ULM": "eurocup|ULM",
    "BGS": "acb|BUR",
    "RIG": "elb|RIG",
    "BCR": "n2627|RS1",
    "RTK": "bbl|HRO",
    "SIA": "lkl|SIA",
    "FRA": "bbl|FRS",
    "WRO": "eurocup|WRO",
    "BUR": "bcl|TOF",
    "TTK": "eurocup|TTK",
    "CLU": "eurocup|CLU",
    "VNC": "eurocup|VNC",
}

TEAM_SLUGS = {
    "ARI":"aris-thessaloniki","TRT":"baglietto-derthona-tortona","BAH":"bahcesehir-college-istanbul",
    "BLK":"balkan-botegrad","BOS":"bosna-bh-telecom-sarajevo","BUD":"buducnost-voli-podgorica",
    "LJU":"cedevita-olimpija-ljubljana","BOU":"cosea-jl-bourg-en-bresse","TRN":"dolomiti-energia-trento",
    "JER":"hapoel-midtown-jerusalem","MAN":"kids&us-manresa","TNF":"la-laguna-tenerife",
    "LEM":"le-mans-sarthe-basket","LKB":"lietkabelis-panevezys","LLI":"london-lions","MRO":"maxima-roma",
    "NAP":"napoli-basketball","KLA":"neptunas-klaipeda","NIN":"niners-chemnitz","PAO":"paok-thessaloniki",
    "ULM":"ratiopharm-ulm","BGS":"recoletos-salud-san-pablo-burgos","RIG":"riga-zelli",
    "BCR":"roma-basketball","RTK":"rostock-seawolves","SIA":"siauliai-basketball",
    "FRA":"skyliners-frankfurt","WRO":"slask-wroclaw","BUR":"tofas-bursa","TTK":"turk-telekom-ankara",
    "CLU":"u-bt-cluj-napoca","VNC":"umana-reyer-venice",
}

# Official EuroCup registrations occasionally include an additional family name
# that is absent from the domestic provider. These links are reviewed identities,
# not fuzzy matches, and keep the existing notes/ratings attached to one person.
IDENTITY_LINKS = {
    "014872": ["lnb-9559", "bcl-0327"],  # Ugo Doumbia Niang / Ugo Doumbia
}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def fold(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def display_name(raw: str) -> str:
    if "," not in raw:
        return raw.title()
    surname, given = (part.strip() for part in raw.split(",", 1))
    return f"{given.title()} {surname.title()}".strip()


def text(node: ET.Element, path: str, default: str = "") -> str:
    value = node.findtext(path)
    return value.strip() if value else default


def integer(value: str | None) -> int | None:
    try:
        parsed = int(value or "")
        return parsed if parsed > 0 else None
    except ValueError:
        return None


def photo(node: ET.Element) -> str | None:
    for item in node.findall("./Images/item"):
        if item.attrib.get("key") == "headshot" and item.text:
            return item.text.strip()
    return None


def registrations(raw: bytes) -> list[dict]:
    """Normalize the feed's inconsistent JSON/XML response into one shape."""
    if raw.lstrip().startswith((b"[", b"{")):
        payload = json.loads(raw)
        rows = payload.get("data", payload) if isinstance(payload, dict) else payload
        output = []
        for row in rows:
            person = row.get("person") or {}
            output.append({
                "type": row.get("type"),
                "active": row.get("active"),
                "code": person.get("code"),
                "name": person.get("name"),
                "dob": (person.get("birthDate") or "")[:10],
                "height": person.get("height"),
                "weight": person.get("weight"),
                "country": (person.get("country") or {}).get("name"),
                "position": row.get("positionName"),
                "number": row.get("dorsal") or row.get("dorsalRaw"),
                "image": (row.get("images") or {}).get("headshot"),
            })
        return output
    root = ET.fromstring(raw)
    output = []
    for row in root.findall("./SeasonPersonModel"):
        person = row.find("Person")
        if person is None:
            continue
        output.append({
            "type": text(row, "Type"),
            "active": text(row, "Active").casefold() == "true",
            "code": text(person, "Code"),
            "name": text(person, "Name"),
            "dob": text(person, "BirthDate")[:10],
            "height": integer(text(person, "Height")),
            "weight": integer(text(person, "Weight")),
            "country": text(person, "Country/Name"),
            "position": text(row, "PositionName"),
            "number": text(row, "Dorsal") or text(row, "DorsalRaw"),
            "image": photo(row),
        })
    return output


def slug(value: str) -> str:
    plain = unicodedata.normalize("NFKD", value)
    plain = "".join(char for char in plain if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", plain.casefold()).strip("-")


def load_database_players() -> list[dict]:
    leagues = json.loads((ROOT / "data" / "data.json").read_text(encoding="utf-8"))["leagues"]
    leagues.extend(json.loads((ROOT / "data.js").read_text(encoding="utf-8"))["leagues"])
    return leagues


def main() -> None:
    leagues = load_database_players()
    existing = [player for league in leagues for player in league.get("players", [])]
    by_id = {player.get("id"): player for player in existing if player.get("id")}
    by_identity: dict[tuple[str, int], list[dict]] = {}
    by_name: dict[str, list[dict]] = {}
    for player in existing:
        player_name = fold(player.get("name"))
        if player_name:
            by_name.setdefault(player_name, []).append(player)
        born = integer(str(player.get("born") or ""))
        if born:
            by_identity.setdefault((player_name, born), []).append(player)

    clubs_payload = json.loads(fetch(f"{API}/clubs"))
    clubs = clubs_payload.get("data", clubs_payload)
    unknown = sorted({club["code"] for club in clubs} - TEAM_KEYS.keys())
    if unknown:
        raise RuntimeError(f"Missing canonical team keys: {', '.join(unknown)}")
    if len(clubs) != 32:
        raise RuntimeError(f"Expected 32 EuroCup clubs, received {len(clubs)}")
    if set(TEAM_SLUGS) != set(TEAM_KEYS):
        raise RuntimeError("Official team slug map does not match the canonical team-key map")

    checked = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    teams: list[dict] = []
    roster: list[dict] = []
    players: list[dict] = []
    matched = 0
    created = 0

    for club in clubs:
        code = club["code"]
        club_name = club["name"]
        team_source = f"https://www.euroleaguebasketball.net/en/eurocup/teams/{TEAM_SLUGS[code]}/roster/{code.casefold()}/"
        teams.append({
            "code": code,
            "name": club_name,
            "key": TEAM_KEYS[code],
            "country": (club.get("country") or {}).get("name") or "",
            "logo": (club.get("images") or {}).get("crest") or "",
            "source": team_source,
            "aliases": list(dict.fromkeys(filter(None, [
                club.get("abbreviatedName"), club.get("editorialName"), club.get("clubPermanentName")
            ]))),
        })

        feed_rows = registrations(fetch(f"{API}/clubs/{code}/people"))
        club_players = 0
        for registration in feed_rows:
            if registration["type"] != "J" or not registration["active"]:
                continue
            euro_code = (registration["code"] or "").strip()
            if not euro_code:
                continue
            raw_name = registration["name"] or ""
            official_name = display_name(raw_name)
            name = official_name
            dob = registration["dob"]
            born = integer(dob[:4])
            euro_id = f"eurocup-{euro_code}"
            direct = by_id.get(euro_id)
            identity_matches = by_identity.get((fold(name), born), []) if born else []
            # Exact normalized names are stable enough to bridge providers even
            # when a legacy feed omitted DOB or incorrectly stored draft year.
            # This also joins NBA and G League copies to the official registration.
            name_matches = by_name.get(fold(name), [])
            reviewed_matches = [by_id[player_id] for player_id in IDENTITY_LINKS.get(euro_code, [])]
            references = list(dict.fromkeys([euro_id] + [
                player["id"] for player in (
                    ([direct] if direct else []) + identity_matches + name_matches + reviewed_matches
                ) if player and player.get("id")
            ]))
            canonical = direct or (identity_matches[0] if identity_matches else None) or (
                reviewed_matches[0] if reviewed_matches else None
            ) or (name_matches[0] if name_matches else None)
            if canonical:
                name = canonical.get("name") or name
                matched += 1
            else:
                created += 1
            position_name = registration["position"] or ""
            role = "Big" if position_name.casefold() in {"center", "big"} else (
                "Forward" if "forward" in position_name.casefold() else "Guard"
            )
            country = registration["country"] or ""
            if country == "United States of America":
                country = "United States"
            image = registration["image"]
            profile = f"https://www.euroleaguebasketball.net/en/eurocup/players/{slug(official_name)}/{euro_code}/"
            height = integer(str(registration["height"] or ""))
            weight = integer(str(registration["weight"] or ""))
            number = str(registration["number"] or "")
            roster.append({
                "id": euro_code,
                "ids": references,
                "name": name,
                "born": born,
                "dob": dob or None,
                "height": height,
                "weight": weight,
                "position": role,
                "nationality": country,
                "number": number,
                "img": image,
                "profile": profile,
                "source": team_source,
                "teamCode": code,
                "teamName": club_name,
                "existing": bool(canonical),
                "match": "EuroCup ID" if direct else (
                    "Full name and birth year" if identity_matches else (
                        "Reviewed identity alias" if reviewed_matches else (
                            "Exact full name" if name_matches else "New official registration"
                        )
                    )
                ),
            })
            players.append({
                "id": euro_id,
                "code": euro_code,
                "name": name,
                "league": "eurocup",
                "team": code,
                "teamName": club_name,
                "born": born,
                "dob": dob or None,
                "height": height,
                "weight": weight,
                "country": country,
                "pos": role,
                "role": role,
                "jersey": number,
                "img": image,
                "url": profile,
                "_rosterOnly": True,
                "_strictIdentity": True,
                "qualified": False,
                "g": None,
                "gameLog": [],
                "pct": {},
                "z": {},
                "arch": [],
            })
            club_players += 1
        if club_players == 0:
            raise RuntimeError(f"Official feed returned no active players for {club_name} ({code})")

    payload = {
        "season": "2026/27",
        "checked": checked,
        "source": SOURCE,
        "teams": teams,
        "roster": roster,
        "players": players,
    }
    target = ROOT / "eurocup-rosters-2026.js"
    target.write_text(
        "window.EUROSCOUT_EUROCUP_ROSTERS=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "checked": checked,
        "teams": len(teams),
        "players": len(players),
        "linked_to_existing": matched,
        "new_profiles": created,
        "le_mans": sum(1 for row in roster if row["teamCode"] == "LEM"),
        "output": str(target),
    }, indent=2))


if __name__ == "__main__":
    main()
