from decimal import Decimal


MKAD_POLYGON = (
    (Decimal("55.9115"), Decimal("37.5450")),
    (Decimal("55.9075"), Decimal("37.6200")),
    (Decimal("55.8950"), Decimal("37.6900")),
    (Decimal("55.8700"), Decimal("37.7550")),
    (Decimal("55.8350"), Decimal("37.8050")),
    (Decimal("55.7850"), Decimal("37.8420")),
    (Decimal("55.7300"), Decimal("37.8450")),
    (Decimal("55.6800"), Decimal("37.8270")),
    (Decimal("55.6250"), Decimal("37.7900")),
    (Decimal("55.5850"), Decimal("37.7200")),
    (Decimal("55.5710"), Decimal("37.6350")),
    (Decimal("55.5820"), Decimal("37.5450")),
    (Decimal("55.6150"), Decimal("37.4650")),
    (Decimal("55.6650"), Decimal("37.4050")),
    (Decimal("55.7350"), Decimal("37.3700")),
    (Decimal("55.8050"), Decimal("37.3900")),
    (Decimal("55.8650"), Decimal("37.4550")),
)


def is_inside_mkad(latitude, longitude) -> bool:
    lat = Decimal(latitude)
    lon = Decimal(longitude)
    inside = False

    for index, point in enumerate(MKAD_POLYGON):
        lat_i, lon_i = point
        lat_j, lon_j = MKAD_POLYGON[index - 1]
        intersects = (lon_i > lon) != (lon_j > lon) and lat < (
            (lat_j - lat_i) * (lon - lon_i) / (lon_j - lon_i) + lat_i
        )

        if intersects:
            inside = not inside

    return inside
