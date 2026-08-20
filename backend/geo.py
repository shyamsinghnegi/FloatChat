def region_for(lat: float, lon: float) -> str:
    if lat >= 5:
        return "Bay of Bengal" if lon >= 78 else "Arabian Sea"
    if lat <= -5:
        return "Southern Indian Ocean"
    return "Equatorial Indian Ocean"


def region_slug(region: str) -> str:
    return region.lower().replace(" ", "-")


REGIONS = ["Bay of Bengal", "Arabian Sea", "Equatorial Indian Ocean", "Southern Indian Ocean"]
REGION_BY_SLUG = {region_slug(r): r for r in REGIONS}
