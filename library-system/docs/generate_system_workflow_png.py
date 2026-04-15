from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


WIDTH = 3200
HEIGHT = 2200
BACKGROUND = "#f6f3ee"
TEXT = "#1f2937"
MUTED = "#5b6472"
LINE = "#264653"
SHADOW = "#d9d2c8"

ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "system-workflow.png"


def load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                Path(r"C:\Windows\Fonts\segoeuib.ttf"),
                Path(r"C:\Windows\Fonts\arialbd.ttf"),
                Path(r"C:\Windows\Fonts\calibrib.ttf"),
            ]
        )
    else:
        candidates.extend(
            [
                Path(r"C:\Windows\Fonts\segoeui.ttf"),
                Path(r"C:\Windows\Fonts\arial.ttf"),
                Path(r"C:\Windows\Fonts\calibri.ttf"),
            ]
        )

    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


TITLE_FONT = load_font(62, bold=True)
SUBTITLE_FONT = load_font(28)
SECTION_FONT = load_font(36, bold=True)
BODY_FONT = load_font(26)
SMALL_FONT = load_font(22)
FOOTER_FONT = load_font(24)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> str:
    wrapped_lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            wrapped_lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            test = f"{current} {word}"
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current = test
            else:
                wrapped_lines.append(current)
                current = word
        wrapped_lines.append(current)
    return "\n".join(wrapped_lines)


def draw_card(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, *, title: str, body: str, fill: str, accent: str) -> None:
    radius = 28
    draw.rounded_rectangle(
        (x + 10, y + 12, x + w + 10, y + h + 12),
        radius=radius,
        fill=SHADOW,
    )
    draw.rounded_rectangle(
        (x, y, x + w, y + h),
        radius=radius,
        fill=fill,
        outline=accent,
        width=5,
    )
    draw.rounded_rectangle(
        (x, y, x + w, y + 72),
        radius=radius,
        fill=accent,
    )
    draw.rectangle((x, y + 40, x + w, y + 72), fill=accent)
    draw.text((x + 24, y + 18), title, font=SECTION_FONT, fill="white")

    body_text = wrap_text(draw, body, BODY_FONT, w - 48)
    draw.multiline_text(
        (x + 24, y + 104),
        body_text,
        font=BODY_FONT,
        fill=TEXT,
        spacing=10,
    )


def draw_tag(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str) -> None:
    bbox = draw.textbbox((0, 0), text, font=SMALL_FONT)
    width = bbox[2] - bbox[0] + 36
    height = bbox[3] - bbox[1] + 18
    draw.rounded_rectangle((x, y, x + width, y + height), radius=20, fill=fill)
    draw.text((x + 18, y + 8), text, font=SMALL_FONT, fill="white")


def draw_arrow(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], *, color: str = LINE, width: int = 8) -> None:
    draw.line(points, fill=color, width=width)
    if len(points) < 2:
        return
    x1, y1 = points[-2]
    x2, y2 = points[-1]
    dx = x2 - x1
    dy = y2 - y1
    if abs(dx) >= abs(dy):
        direction = 1 if dx >= 0 else -1
        head = [(x2, y2), (x2 - 22 * direction, y2 - 12), (x2 - 22 * direction, y2 + 12)]
    else:
        direction = 1 if dy >= 0 else -1
        head = [(x2, y2), (x2 - 12, y2 - 22 * direction), (x2 + 12, y2 - 22 * direction)]
    draw.polygon(head, fill=color)


def draw_title(draw: ImageDraw.ImageDraw) -> None:
    draw.text((110, 70), "Salazar Library System Workflow", font=TITLE_FONT, fill=TEXT)
    subtitle = (
        "PNG overview generated from the current Django routes, auth flows, "
        "circulation models, and staff operations."
    )
    draw.text((112, 154), subtitle, font=SUBTITLE_FONT, fill=MUTED)
    draw.line((110, 214, WIDTH - 110, 214), fill="#d8cec1", width=3)


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)

    draw_title(draw)

    cards = {
        "onboarding": (110, 280, 900, 520),
        "signin": (1160, 280, 900, 520),
        "session": (2210, 280, 880, 520),
        "circulation": (110, 920, 1320, 760),
        "reservations": (1570, 920, 920, 760),
        "staff": (2630, 920, 460, 760),
    }

    draw_card(
        draw,
        *cards["onboarding"],
        title="1. Account Onboarding",
        body=(
            "Check student or faculty ID availability.\n"
            "Submit registration.\n"
            "System creates an inactive account.\n"
            "Send email OTP.\n"
            "User verifies email.\n"
            "Account waits for staff approval before full access."
        ),
        fill="#fff8e8",
        accent="#d97706",
    )

    draw_card(
        draw,
        *cards["signin"],
        title="2. Sign-In Security",
        body=(
            "User enters ID and password.\n"
            "Throttle and lockout protections apply.\n"
            "If the email is not verified, the backend issues an otp_session and requires OTP.\n"
            "If the account is active, the API issues JWT access and refresh tokens."
        ),
        fill="#edf7ff",
        accent="#2563eb",
    )

    draw_card(
        draw,
        *cards["session"],
        title="3. Authenticated Session",
        body=(
            "Profile and avatar updates.\n"
            "Notifications and unread counts.\n"
            "Change password.\n"
            "Refresh token rotation.\n"
            "Logout with refresh-token blacklist."
        ),
        fill="#eefbf3",
        accent="#15803d",
    )

    draw_card(
        draw,
        *cards["circulation"],
        title="4. Patron Circulation Flow",
        body=(
            "Browse catalog and public stats.\n"
            "Submit borrow request.\n"
            "Library staff approve or reject.\n"
            "If approved, a copy is assigned and a due date is set.\n"
            "Teachers use a reporting schedule instead of a normal due date.\n"
            "User can request return or renewal.\n"
            "Returned books can be reviewed and rated."
        ),
        fill="#f7f0ff",
        accent="#7c3aed",
    )

    draw_card(
        draw,
        *cards["reservations"],
        title="5. Reservations, Fines, Alerts",
        body=(
            "If no copy is available, user joins a reservation queue.\n"
            "When a book is returned, the next reservation can be notified.\n"
            "Overdue borrows generate pending fines.\n"
            "Borrowing is blocked above the unpaid fine threshold.\n"
            "Notifications cover approvals, due-soon reminders, returns, renewals, reservations, and fines."
        ),
        fill="#fff1f2",
        accent="#e11d48",
    )

    draw_card(
        draw,
        *cards["staff"],
        title="6. Staff and Admin",
        body=(
            "Approve or reject accounts.\n"
            "Manage books, categories, and copies.\n"
            "Approve borrow, return, and renewal requests.\n"
            "Record fine payments or waivers.\n"
            "Import enrollment records.\n"
            "Export reports."
        ),
        fill="#eef2ff",
        accent="#4338ca",
    )

    draw_tag(draw, 148, 825, "Registration", "#b45309")
    draw_tag(draw, 1178, 825, "JWT + OTP", "#1d4ed8")
    draw_tag(draw, 2240, 825, "Protected APIs", "#166534")
    draw_tag(draw, 148, 1705, "Borrow / Return / Renew", "#6d28d9")
    draw_tag(draw, 1595, 1705, "Queue + Fines", "#be123c")
    draw_tag(draw, 2655, 1705, "Approval Desk", "#3730a3")

    # Main flow arrows.
    draw_arrow(draw, [(1010, 540), (1110, 540), (1110, 540), (1160, 540)])
    draw_arrow(draw, [(2060, 540), (2160, 540), (2160, 540), (2210, 540)])
    draw_arrow(draw, [(2650, 760), (2650, 860), (2810, 860), (2810, 920)])
    draw_arrow(draw, [(1430, 1300), (1510, 1300), (1510, 1300), (1570, 1300)])

    # Session to circulation and operational feedback loops.
    draw_arrow(draw, [(2520, 800), (2520, 880), (770, 880), (770, 920)])
    draw_arrow(draw, [(2210, 1450), (2080, 1450), (2080, 1450), (1570, 1450)])
    draw_arrow(draw, [(2490, 1500), (2570, 1500), (2570, 1300), (2630, 1300)])

    # Staff influence on onboarding and circulation.
    draw_arrow(draw, [(2630, 1100), (2480, 1100), (2480, 700), (1010, 700)])
    draw_arrow(draw, [(2630, 1380), (2500, 1380), (2500, 1440), (2490, 1440)])
    draw_arrow(draw, [(2860, 920), (2860, 840), (2860, 840), (2860, 800)])

    # Footer status strip.
    footer_y = 1850
    draw.rounded_rectangle((110, footer_y, WIDTH - 110, 2070), radius=26, fill="#fffdf9", outline="#d8cec1", width=3)
    draw.text((140, footer_y + 26), "Key Status Lifecycles", font=SECTION_FONT, fill=TEXT)

    footer_lines = [
        "Account: inactive -> email verified -> approved active account",
        "Borrow request: pending -> approved or rejected -> returned",
        "Return / renewal: pending -> approved or rejected",
        "Reservation: pending -> notified -> fulfilled, cancelled, or expired",
        "Fine payment: pending -> paid or waived",
    ]
    current_y = footer_y + 92
    for line in footer_lines:
        draw.text((150, current_y), f"- {line}", font=FOOTER_FONT, fill=TEXT)
        current_y += 38

    image.save(OUTPUT_PATH, format="PNG")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
