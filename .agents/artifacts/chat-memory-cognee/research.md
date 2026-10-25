# Research: Dùng Cognee làm trí nhớ dài hạn theo từng kênh ZCA

Route: research · Authority: research-only · Ngày: 2026-10-25 · Bản 2: đã kiểm chứng trên docs.cognee.ai (anh Đạt cung cấp)

## 1. Câu hỏi

Có nên dùng Cognee làm trí nhớ dài hạn cho từng kênh ZCA, thay cho tầng "Hiểu về người" và "Nhật ký ngày/tháng" trong `.agents/artifacts/chat-memory-long-term-v2/design.md`?

Quyết định đã chốt có ảnh hưởng tới đánh giá: AI chạy đêm dùng 9router (chấp nhận gửi cả chat trong ngày ra ngoài); điều tự học dùng ngay, xoá được; tin bị thu hồi vẫn phải xoá khỏi trí nhớ.

## 2. Sửa lại các nhận định sai ở bản 1

| Bản 1 nói | Tài liệu nói | Nguồn |
| --- | --- | --- |
| Chỉ có Python | Có SDK TypeScript chính thức `@cognee/cognee-ts` (Node binding của engine Rust `cognee-rs`), và REST server FastAPI (`/api/v1/...`, cổng 8000, image `cognee/cognee:main`) | `typescript/getting-started.md`, `guides/deploy-rest-api-server.md` |
| Chưa tới 1.0, API đổi nhanh | Bản mới nhất v1.6.5 (16/10/2026), Apache 2.0. API mới (`remember`/`recall`/`improve`/`forget`) có từ v1.0; `add`/`cognify`/`search` thành legacy, nghĩa là API thật sự đã đổi tên một lần | `changelog.md`, `core-concepts/overview.md` |
| Phải thêm kho riêng | Dùng được Postgres + pgvector cho cả quan hệ lẫn vector. Graph mặc định là file nhúng (Kuzu/Ladybug), không cần server | `setup-configuration/relational-databases.md`, `vector-stores.md`, `graph-stores.md` |
| Rất khó xoá tin bị thu hồi | Có `forget(data_id, dataset)`: xoá node chỉ thuộc về mục bị xoá cùng các cạnh nối vào chúng. Node dùng chung thì giữ lại; cạnh giữa hai node dùng chung còn sống "không bị xoá riêng" (tài liệu tự mâu thuẫn ở điểm này) | `core-concepts/main-operations/forget.md` |
| Quyền riêng tư là vướng mắc chính | Không còn là điểm khác biệt: anh đã chọn gửi cả chat trong ngày qua 9router cho job chạy đêm, nên Cognee hay tự làm đều gửi cùng một lượng dữ liệu | Quyết định Q1 |

## 3. Những gì Cognee làm được (đã kiểm chứng)

- **Thao tác chính**: `remember` (nạp dữ liệu và dựng graph), `recall` (hỏi), `improve` (làm giàu thêm), `forget` (xoá). Trang: `core-concepts/main-operations/*.md`.
- **Nạp dữ liệu**: chia đoạn khoảng 1.500 token. Mỗi đoạn **2 lượt gọi LLM** (trích thực thể/quan hệ + tóm tắt), hoặc 1 lượt với `summary_method="from_extraction"`. Một ngày chat 300 tin, khoảng 6.000 token, ra 4–8 lượt gọi. `remember` mặc định chạy thêm một lượt `improve` (tắt bằng `self_improvement=False`). Trang: `legacy-operations/cognify.md`.
- **Không nạp lại thứ đã có**: trùng nội dung thì bỏ qua (hash); chỉ xử lý mục mới hoặc mục đã đổi.
- **Cô lập theo kênh**: mỗi kênh một dataset. `recall(datasets=[...])` chỉ tìm trong dataset đó. Khi bật access control (mặc định), mỗi dataset có graph/vector riêng về mặt vật lý. Lưu ý: tài liệu ghi khi tắt access control thì bộ lọc `datasets` **bị bỏ qua**, nên phải để bật. Trang: `multi-user-mode/data-isolation-and-multi-tenancy.md`.
- **Theo thời gian**: graph thời gian bật sẵn; ngày tháng **nằm trong chữ** được trích thành node `Timestamp`. Hỏi bằng `query_type=TEMPORAL`. Bộ tự chọn loại câu hỏi chỉ nhận dạng câu kiểu tiếng Anh ("in 2019"), không nhận "năm ngoái". Trang: `guides/temporal-knowledge-graph.md`.
- **LLM**: endpoint OpenAI-compatible qua `LLM_PROVIDER="custom"` + `LLM_ENDPOINT` + `LLM_MODEL="openai/<model>"`, nên trỏ được vào 9router. Việc trích graph dựa vào JSON có cấu trúc; tài liệu cảnh báo model yếu có thể trả JSON hỏng (tự thử lại tối đa 3 lần). Trang: `setup-configuration/llm-providers.md`, `structured-output-backends.md`.
- **Embedding là bắt buộc.** Mặc định là OpenAI. Cấu hình LLM mà không cấu hình embedding thì `remember` báo lỗi `ProviderConfigMismatchError`. Các model fastembed mặc định là tiếng Anh (`bge-small-en`, `all-MiniLM-L6-v2`). Trang: `setup-configuration/embedding-providers.md`.
- **Tiếng Việt**: có bước dịch sang tiếng Anh (`translate_content`, phát hiện được `vi`), nhưng chỉ chạy trong pipeline tự dựng. Tài liệu không nói gì về chất lượng khi giữ nguyên tiếng Việt. Trang: `guides/multilingual-ingestion.md`.
- **Session**: có trí nhớ phiên, nhưng cửa sổ cố định 10 mục, dạng hỏi–đáp, không hợp với chat nhóm. Vẫn giữ trí nhớ ngắn hạn của mình. Trang: `core-concepts/sessions-and-caching.md`.
- **Bảo mật vận hành**: telemetry **bật sẵn**, gửi về `test.prometh.ai` (tắt bằng `TELEMETRY_DISABLED=true`). Phải đặt `FASTAPI_USERS_JWT_SECRET`, nếu không token hỏng mỗi lần khởi động lại; có thể dùng `X-Api-Key`. Trang: `setup-configuration/security.md`, `guides/deploy-rest-api-server.md`.

## 4. Đánh giá lại theo tiêu chí của dự án

| Tiêu chí | Cognee | Nhận xét |
| --- | --- | --- |
| Sửa lỗi "mèo đen" | ❌ | `recall` vẫn tìm theo câu hỏi. Ghi nhớ luôn nằm trong prompt vẫn là thứ bắt buộc, làm ở giai đoạn 1 dù chọn gì. |
| Theo từng kênh | ✅ | Mỗi kênh một dataset, phải bật access control. |
| Hiểu về người, quan hệ | ✅ (cần thử) | Đây là thế mạnh của graph. Rủi ro: node được nhận diện theo **tên viết thường**, nên "Hằng", "chị Hằng", "vợ anh Đạt", "Diệu Hằng" dễ thành bốn node khác nhau trong tiếng Việt. |
| Hỏi theo thời gian | ⚠️ | Có sẵn, nhưng phải đưa ngày vào chữ khi nạp (ví dụ mỗi tài liệu là một ngày chat có tiêu đề ngày) và tự truyền `TEMPORAL`, vì bộ tự chọn không hiểu câu tiếng Việt. |
| Thu hồi tin (Q3) | ⚠️ | Cần thử: fact rút ra từ tin bị thu hồi mà nằm giữa hai node dùng chung có thể vẫn còn. Cách gỡ: nạp mỗi ngày chat là một tài liệu; khi có tin bị thu hồi thì `forget` tài liệu ngày đó rồi nạp lại bản không có tin ấy, và kiểm tra fact đã mất chưa. |
| Chi phí LLM | ✅ | 4–8 lượt mỗi kênh mỗi ngày, có sẵn giới hạn tần suất và tự lùi khi gặp 429. Tương đương cách tự làm. |
| Model qua 9router | ⚠️ | `chat-daily` là alias, model phía sau có thể đổi bất cứ lúc nào. Việc trích graph cần JSON ổn định, nên phải thử. |
| Embedding tiếng Việt | ⚠️ | Phải chọn model đa ngôn ngữ. Ứng viên: Gemini embedding (đã có key dự phòng), hoặc Ollama `bge-m3`. Chưa rõ 9router có `/v1/embeddings` không. |
| Vận hành | ⚠️ | Thêm container Python; đổi image Postgres sang bản có pgvector; graph là file Kuzu trong volume (chỉ một tiến trình ghi, không có bản sao). Chấp nhận được với một máy chủ cá nhân, nhưng là một service nữa phải theo dõi. |
| Gọi từ NestJS | ✅ | REST `/api/v1/remember`, `/recall`, `/forget`. SDK TS là engine Rust, chưa rõ có ngang tính năng bản Python không, nên REST an toàn hơn. |
| Vẫn phải giữ `zca_messages` | — | Cần cho cửa sổ ngắn hạn, trích câu gốc, xử lý thu hồi, nạp lại. |

## 5. Kết luận (thay cho bản 1)

- Cognee **khả thi hơn em đánh giá ở bản 1**: có REST và SDK TS, dùng được Postgres + pgvector, có `forget`, có graph thời gian, đã qua 1.0. Vướng mắc quyền riêng tư không còn là điểm khác biệt sau quyết định Q1.
- Cognee chỉ thay được tầng 2–3 của thiết kế ("Hiểu về người", "Nhật ký"). Tầng Ghi nhớ, cửa sổ ngắn hạn và `zca_messages` vẫn phải tự làm.
- Bốn điểm chưa chắc chỉ trả lời được bằng dữ liệu thật: nhận diện người trong tiếng Việt, độ ổn định của JSON qua 9router, câu hỏi thời gian bằng tiếng Việt, và việc xoá triệt để khi tin bị thu hồi.

## 6. Đề xuất bước tiếp theo

1. **Giai đoạn 1 giữ nguyên** (Ghi nhớ, chuyển ngắn hạn sang `zca_messages`, cột loại tin, gộp giao diện). Không phụ thuộc lựa chọn Cognee.
2. **Spike Cognee có giới hạn thời gian (1–2 ngày công), tách khỏi repo chính**: một container `cognee/cognee:main` với access control bật, telemetry tắt, LLM trỏ vào 9router, embedding đa ngôn ngữ. Nạp 1–2 tuần chat thật của một nhóm (xuất từ `zca_messages`, mỗi ngày một tài liệu có tiêu đề ngày).
3. **Tiêu chí đạt của spike**:
   - Mỗi người trong nhóm ra đúng một node (ít nhất sau khi đưa danh sách thành viên vào prompt trích).
   - Không có lỗi JSON làm hỏng việc nạp.
   - Trả lời đúng 8/10 câu hỏi mẫu tiếng Việt (chuyện cũ, theo tháng, về người).
   - `forget` rồi nạp lại một ngày bỏ một tin thì fact của tin đó biến mất.
   - Chi phí và thời gian nạp mỗi ngày chấp nhận được.
4. **Đạt** → giai đoạn 2 dùng Cognee cho tầng 2–3. **Không đạt** → giai đoạn 2 tự làm (tóm tắt ngày + bảng fact) như trong `design.md`.

## 7. Trang tài liệu đã đọc

`llms.txt`, `llms-core.md`, `llms-api.md`; `getting-started/introduction`, `installation`; `typescript/getting-started`; `core-concepts/overview`, `main-operations/remember`, `recall`, `improve`, `forget`, `legacy-operations/add`, `cognify`, `search`, `memify`, `delete`; `sessions-and-caching`; `further-concepts/datasets`, `node-sets`, `chunkers`; `multi-user-mode/data-isolation-and-multi-tenancy`; `guides/temporal-knowledge-graph`, `multilingual-ingestion`, `persistent-memory-across-sessions`, `deploy-rest-api-server`, `store-configurations`; `setup-configuration/overview`, `llm-providers`, `structured-output-backends`, `embedding-providers`, `relational-databases`, `vector-stores`, `graph-stores`, `permissions`, `security`; `api-reference/introduction`, `auth/login`, `recall`, `forget`, `datasets/delete-dataset`; `changelog` (một phần); `cognee-cloud/overview`. Trang API của `POST /api/v1/remember` trả 404.
