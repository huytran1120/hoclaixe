# Học Lái Xe — Ôn tập & Thi thử 600 câu hỏi sát hạch

Ứng dụng web mã nguồn mở giúp mọi người ôn tập và thi thử bộ **600 câu hỏi lý thuyết sát hạch lái xe cơ giới đường bộ** ngay trên trình duyệt, không cần đăng nhập.

## Tính năng

- **Ôn tập 600 câu hỏi**:
  - Phân loại đầy đủ theo 6 chương chuẩn kèm 319 hình minh họa biển báo và sa hình (hỗ trợ nhấn để phóng to).
  - Hai chế độ học linh hoạt: *Tự kiểm tra* (có tùy chọn tự chuyển câu khi chọn đúng) và *Hiện sẵn đáp án* (học nhanh / học thuộc).
  - Tìm kiếm nhanh theo số câu hoặc từ khóa, lọc theo trạng thái (*Tất cả*, *Chưa làm*, *Làm sai*, *Đã lưu*).
  - Đánh dấu câu hỏi khó để ôn lại sau và tự động lưu tiến độ học trên trình duyệt (`localStorage`).
  - Tối ưu cả **máy tính** (bố cục 2 cột, phím tắt `←` / `→`, `1`–`4`, `Space`, `B`) và **điện thoại** (câu hỏi hiển thị ngay trên đầu, vuốt trái/phải chuyển câu, thanh điều hướng cố định phía dưới & ngăn kéo trượt chọn câu) cùng giao diện **Sáng / Tối**.
- **Thi thử theo chuẩn hạng B**:
  - **Bộ 20 đề chuẩn** cố định và chế độ **Tạo đề ngẫu nhiên** (30 câu trong 20 phút, đạt khi đúng tối thiểu 27/30 câu).
  - Bố cục mỗi đề gồm: 9 câu quy định & quy tắc giao thông, 1 văn hóa giao thông, 1 kỹ thuật lái xe, 1 cấu tạo & sửa chữa, 9 báo hiệu đường bộ và 9 giải thế sa hình.
  - Chấm điểm chi tiết theo từng chương, lọc nhanh các câu làm sai để xem lại và lưu lịch sử bài thi.
- **Thống kê tiến độ**:
  - Theo dõi tỷ lệ hoàn thành và độ chính xác theo từng chương, ôn nhanh nhóm câu hay làm sai hoặc câu đã đánh dấu.

## Công nghệ sử dụng

- Next.js 16 (App Router) & React 19
- TypeScript & Tailwind CSS v4
- Dữ liệu tĩnh JSON + hình ảnh WebP (hỗ trợ xuất trang tĩnh lên GitHub Pages)

## Chạy ở máy cá nhân

Yêu cầu Node.js `>= 20.9.0`:

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trên trình duyệt.

## Các lệnh hữu ích

- `npm run dev` — Chạy môi trường phát triển
- `npm run build` — Build bản production
- `npm run build:pages` — Xuất bản tĩnh (static export) cho GitHub Pages tại đường dẫn `/hoclaixe`
- `npm run lint` — Kiểm tra ESLint
- `npm run typecheck` — Kiểm tra kiểu TypeScript
