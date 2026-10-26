---
name: Pomodoro cho Obsidian
description: Đồng hồ học tập với vỏ xanh lục và mặt LCD xám.
colors:
  light-page: "#f7fafc"
  light-surface: "#edf1f4"
  light-border: "#c4ced7"
  light-ink: "#24364b"
  light-title: "#132b43"
  light-muted: "#50657a"
  light-accent: "#1670a0"
  light-primary: "#69bfdf"
  light-primary-hover: "#59b4d5"
  light-primary-text: "#102934"
  light-button: "#e8f3f8"
  light-button-hover: "#deedf4"
  light-button-border: "#b2cedb"
  light-button-text: "#21516b"
  light-shell: "#78c49b"
  light-shell-border: "#428264"
  light-shell-light: "#a0d5b8"
  light-shell-shade: "#5bac83"
  light-top: "#8acba8"
  light-top-light: "#b0ddc3"
  light-shadow: "#122d3d14"
  light-lcd: "#e3e7e4"
  light-lcd-shadow: "#cbd2d0"
  light-lcd-ink: "#171c20"
  light-error: "#922e36"
  dark-page: "#1c1e1f"
  dark-surface: "#293136"
  dark-border: "#3b454e"
  dark-ink: "#dce3e9"
  dark-title: "#f1f5f7"
  dark-muted: "#a8b5c1"
  dark-accent: "#79d2f4"
  dark-primary: "#66b9d8"
  dark-primary-hover: "#76c3df"
  dark-button: "#293f49"
  dark-button-hover: "#304a56"
  dark-button-border: "#4a6876"
  dark-button-text: "#cee6f0"
  dark-shell: "#65a984"
  dark-shell-border: "#3f7058"
  dark-shell-light: "#86bc9e"
  dark-shell-shade: "#508767"
  dark-top: "#77b494"
  dark-top-light: "#96c8ad"
  dark-shadow: "#00000028"
  dark-lcd: "#b1bbb6"
  dark-lcd-shadow: "#98a59e"
  dark-error: "#f1a8b1"
  phase-ink: "#303b3e"
  next-ink: "#424b4e"
typography:
  title:
    fontFamily: "var(--font-interface,Arial,sans-serif)"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "normal"
  body:
    fontFamily: "var(--font-interface,Arial,sans-serif)"
    fontSize: "15px"
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-interface,Arial,sans-serif)"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  panel: "16px"
  shell: "30px"
  shell-compact: "25px"
  lcd: "16px"
  lcd-compact: "13px"
  control: "8px"
spacing:
  control-gap: "10px"
  field-gap: "20px"
  panel-inset: "24px"
  compact-inset: "16px"
components:
  button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-primary-text}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.light-primary-hover}"
  button-secondary:
    backgroundColor: "{colors.light-button}"
    textColor: "{colors.light-button-text}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.light-button-hover}"
  input-wrap:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-title}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.light-page}"
    rounded: "{rounded.panel}"
    width: "100%"
  clock-shell:
    backgroundColor: "{colors.light-shell}"
    rounded: "{rounded.shell}"
    padding: "17px 17px 21px"
---

# Design System: Pomodoro cho Obsidian

## Overview

**Creative North Star: "Đồng hồ học tập chính diện"**

Thiết kế đã duyệt mô phỏng đồng hồ nhìn chính diện: vỏ xanh lục bo góc, thanh nhô phía trên, mặt LCD xám và số đen bảy đoạn nét dày góc vát. Nút xanh da trời là điểm thao tác rõ ràng.

Đây là giao diện công cụ đang vận hành (Operate): trạng thái, thời gian và thao tác phiên học hiện diện trực tiếp. Tên ẩn dụ bên dưới là mô tả tài liệu cho thiết kế hiện hành, không phải một tuyên bố thương hiệu mới của người dùng. Các kích thước và token trích từ CSS là lựa chọn triển khai.

**Key Characteristics:**

- Góc chính diện, vỏ xanh lục và thanh nhô dài 64%.
- LCD xám trong cả theme sáng và tối.
- Chữ số SVG bảy đoạn, nét ẩn opacity 0.045.
- Nút xanh da trời và bố cục theo chiều rộng vùng nhúng.

## Colors

Màu vỏ xanh lục và nút xanh da trời giữ nhận diện, còn nền cùng chữ phụ thích ứng theme của Obsidian. Frontmatter ghi nguyên giá trị CSS; tonal ramp trong sidecar được sinh riêng để xem bảng màu, không phải token runtime đã được duyệt; `light-*` và `dark-*` ánh xạ hai theme, không phải hai thiết kế khác nhau.

### Primary

Nhóm `shell`, `shell-border`, `shell-light`, `shell-shade`, `top`, `top-light` tạo vỏ xanh và thanh nhô, với biến thể sáng/tối tương ứng.

### Secondary

Nhóm `primary`, `primary-hover`, `primary-text` dành cho hành động chính; `button`, `button-hover`, `button-border`, `button-text` dành cho nút phụ. `accent` dùng cho dấu trạng thái và focus.

### Neutral

`page`, `surface`, `border`, `ink`, `title`, `muted` tạo khung, trường nhập và văn bản. `lcd` và `lcd-shadow` là mặt xám; `light-lcd-ink` dùng chung ở cả hai theme vì CSS tối không ghi đè biến này. `light-primary-text` cũng được kế thừa trong theme tối. `phase-ink` và `next-ink` giữ nguyên giữa hai theme. `shadow` là màu bóng; `error` dành cho thông báo và viền lỗi.

**The Gray LCD Rule.** Mặt LCD vẫn xám và số vẫn đen khi theme Obsidian thay đổi.

## Typography

UI dùng font giao diện Obsidian, fallback Arial và sans-serif; không tải font riêng. Title, body và label được ghi trong frontmatter. Trạng thái và gợi ý dùng chữ nhỏ (12px); nhãn pha (14px, 700); thông tin phiên sau (13px); trường thời lượng (18px) dùng `tabular-nums`.

Thời gian không có display font: các chữ số là path SVG với nét dày, đầu góc vát, stroke (1.2) và linejoin tròn. Mỗi chữ số tiến (60) đơn vị, dấu hai chấm tiến (22) đơn vị, viewBox cao (94). Khung SVG rộng tối đa (396px), cao (138px), còn (108px) khi container không quá (480px). Nét tắt vẫn hiện ở opacity (0.045). `aria-label` cung cấp thời gian bằng lời; không đọc lại từng giây.

## Layout

Khung ngoài rộng (100%), tối đa (1040px), padding (24px 16px). Panel giữa rộng tối đa (640px). Header và settings là flex; điều khiển căn giữa; feedback và thông tin phiên sau có thể xuống dòng.

Bố cục dựa trên container `pomodoro`, không dựa viewport. Tại chiều rộng tối đa (480px), giảm inset về (16px), vỏ và LCD thu nhỏ, giảm chiều cao SVG. Tại (300px), settings chuyển thành cột, giảm khoảng cách và bỏ min-width cố định của nút chính. Trạng thái thời gian dài giữ cùng renderer SVG với viewBox theo số chữ số.

## Elevation & Depth

Độ sâu nằm ở vật thể đồng hồ, không ở nút: viền vỏ (3px), highlight trong phía trên (4px), bóng trong phía dưới (7px) và bóng ngoài (0 8px 16px). Thanh nhô có highlight trong (3px); LCD có bóng lõm trên (3px). Màu lấy từ theme tương ứng. Panel dùng viền (1px); nút và trường nhập không có box-shadow. Công thức chính xác nằm trong sidecar.

## Shapes

Panel và LCD dùng góc cong vừa, vỏ dùng góc cong lớn; bán kính hiện hành ở frontmatter. Thanh nhô nằm từ (18%) theo chiều ngang, dài (64%), cao (10px), nhô trên vỏ (11px); chỉ hai góc trên bo (5px), không viền dưới. Nút và ô nhập chung góc (8px). Hình số là bảy đoạn góc vát, không phải hình ảnh raster.

## Components

### Buttons

Nút chính xanh da trời, min-width (136px), chiều cao tối thiểu (40px); nhãn đổi giữa Bắt đầu, Tạm dừng và Tiếp tục theo trạng thái. Nút phụ dùng màu nhạt hơn cho Đặt lại và Thử lưu lại. Padding và biến thể hover ở frontmatter. Hover đổi nền/viền; focus-visible dùng outline accent (2px), offset (3px). CSS không định nghĩa transition hay active riêng.

### Cards / Containers

Panel có nền theo theme, viền mảnh và overflow hidden. Đồng hồ là thành phần nhận diện với vỏ nổi, thanh nhô và LCD lõm; chỉ vật thể này dùng bóng tạo hình. Header hiện tên và trạng thái bằng chữ kèm chấm màu, không chỉ dựa vào màu.

### Inputs / Fields

Hai trường Thời gian học / Thời gian nghỉ có nhãn, đơn vị phút và số canh theo tabular-nums. Vỏ trường dùng surface và viền theo theme. Chỉ chỉnh khi sẵn sàng; disabled opacity (0.65). Dữ liệu không hợp lệ có outline error (2px), offset (3px), cùng thông báo chữ. Focus dùng outline accent như nút.

### Seven-segment LCD

Số đen đứng trên LCD xám, có nhãn pha phía trên và phiên tiếp theo phía dưới. Nét ẩn dùng chung geometry với nét sáng, chỉ đổi opacity. Không có font số hoặc nút đổi theme riêng.

### Feedback

Thông báo validation hoặc lưu thất bại dùng màu error, có thể xuống dòng với nút Thử lưu lại. Thiết kế tiếp tục hiển thị timer trong trạng thái lỗi.

## Do's and Don'ts

### Do:

- **Do** giữ mặt LCD xám và nét số đen trong cả hai theme.
- **Do** dùng SVG bảy đoạn cho thời gian và văn bản truy cập được cho trình đọc màn hình.
- **Do** đáp ứng chiều rộng container để cùng thiết kế dùng được trong dashboard và note.

### Don't:

- **Don't** thay chữ số SVG bằng font seven-segment.
- **Don't** thêm nút đổi theme riêng hoặc thanh điều khiển mockup.
- **Don't** làm nét ẩn đậm hơn opacity 0.045 trong hệ hiện hành.
