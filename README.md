# Hiếu Gà Phim Stremio Add-on

Add-on Stremio không chính thức, lấy dữ liệu phim từ nguồn **phimapi.com**
(cùng chuẩn dữ liệu với OPhim) - dùng để hiển thị theo phong cách **Hiếu Gà
Phim** (hieugaphim.fun).

Bao gồm 5 danh mục: Mới cập nhật, Phim lẻ, Phim bộ, Hoạt hình, TV Shows, hỗ
trợ tìm kiếm và lọc đúng loại phim theo từng danh mục.

## Cấu trúc dự án

```
hieugaphim-stremio-addon/
├── lib/
│   └── addon-builder.js   ← logic addon dùng chung
├── api/
│   └── index.js           ← entry point cho Vercel
├── addon.js                ← entry point cho Render/Docker/local
├── vercel.json
├── package.json
└── README.md
```

## Deploy lên Vercel (khuyên dùng - miễn phí, không cần thẻ)

1. Đưa toàn bộ code lên 1 repo GitHub mới (tạo repo → Add file → Upload
   files → kéo thả các file trên, giữ đúng cấu trúc thư mục `lib/` và `api/`)
2. Vào [vercel.com](https://vercel.com) → đăng nhập bằng GitHub
3. **Add New... → Project** → **Import** repo vừa tạo
4. Framework Preset: **Other** → **Deploy**
5. Xong sẽ có URL dạng `https://ten-app.vercel.app/manifest.json`

Dán URL đó vào Stremio (Add-ons → dán vào ô Add-on Repository URL → Install).

## Chạy local để test trước khi deploy

```bash
npm install
npm start
```
Rồi cài vào Stremio bằng: `http://127.0.0.1:7000/manifest.json`

## Ghi chú kỹ thuật

- Nguồn dữ liệu: `phimapi.com` — cùng cấu trúc JSON với OPhim (đã xác nhận
  qua tài liệu API công khai của KKPhim/phimapi.com).
- Danh sách phim: `GET /v1/api/danh-sach/{loại}` hoặc `GET
  /danh-sach/{loại}` (addon tự thử cả 2 dạng, dùng dạng nào trả dữ liệu thật).
- Tìm kiếm: `GET /v1/api/tim-kiem?keyword=...` hoặc `GET
  /tim-kiem?keyword=...`, sau đó addon tự lọc lại đúng loại phim theo từng
  danh mục (vì API tìm kiếm trả về tất cả loại phim trộn lẫn).
- Chi tiết phim & danh sách tập: `GET /phim/{slug}` (thử thêm `GET
  /v1/api/phim/{slug}` nếu dạng đầu không có dữ liệu - **CHƯA kiểm chứng
  100% dạng nào đúng cho phimapi.com**, xem mục "Nếu gặp lỗi" bên dưới).
- Ảnh poster/thumbnail: ưu tiên dùng URL đầy đủ mà API trả về sẵn trong
  `poster_url`/`thumb_url`. Chỉ khi giá trị chỉ là filename tương đối mới
  ghép thêm domain `https://phimimg.com/` (dự phòng, **chưa kiểm chứng**).

## Nếu gặp lỗi (rất có thể xảy ra vì 1 số endpoint chưa kiểm chứng 100%)

Do tôi (Claude) chưa gọi thử trực tiếp được API `phimapi.com` để xác nhận
100% từng endpoint (giới hạn công cụ chỉ cho phép xem qua kết quả tìm kiếm
gián tiếp), rất có thể gặp lỗi tương tự như hồi debug addon OPhim trước đó:
tìm kiếm không ra kết quả, ảnh không hiện, hoặc phim không phát được.

Cách xử lý giống hệt lần trước — làm theo đúng quy trình đã áp dụng thành
công với addon OPhim:

1. Mở trực tiếp URL catalog trong trình duyệt để xem addon trả về gì, ví dụ:
   ```
   https://ten-app.vercel.app/catalog/movie/hieugaphim-phim-le.json
   ```
2. Nếu `"metas":[]`, vào Vercel Dashboard → **Runtime Logs**, thử lại rồi
   xem dòng log lỗi (`danh-sach: không có endpoint nào trả về dữ liệu. ...`)
   để biết endpoint nào bị sai, gửi lại nội dung log để được hỗ trợ sửa
   đúng endpoint.
3. Nếu phim hiện nhưng không phát được (stream), có thể domain `phim/{slug}`
   sai định dạng — cũng xem Runtime Logs khi bấm phát 1 phim để lấy lỗi
   chi tiết.
