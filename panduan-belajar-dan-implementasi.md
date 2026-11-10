# Panduan Belajar dan Implementasi: Peta Dokumentasi, Sandbox, dan Repo

Dokumen pendamping `schema-matcher-rekap.md`. Tujuannya satu: **mengurangi apa yang harus Anda baca dan mengunci di mana setiap hal dikerjakan.**

---

## 0. Cara memakai dokumen ini

### Akar masalah rasa kewalahan

Sidebar dokumentasi Pydantic punya sekitar 19 halaman, dan halaman *Models* saja punya sekitar 20 bagian. Dokumentasi dibuat sebagai **kamus** untuk semua pengguna, bukan sebagai **novel** untuk dibaca dari atas. Kalau Anda membacanya berurutan, Anda akan membaca 90% hal yang tidak dipakai proyek ini.

### Lima aturan

1. **Daftar bacaan di dokumen ini adalah batas atas.** Bagian yang tidak tertulis di kolom "Baca" berarti **tutup**, bahkan kalau terlihat menarik.
2. **Urutan kerja: coba → prediksi → jalankan → baru baca satu bagian yang menjelaskan selisihnya.** Jangan membaca dulu baru mencoba.
3. **Tiga lapis membaca** (sesuai kebiasaan Anda): lapis 1 lihat judul saja (5 menit), lapis 2 baca bagian yang terdaftar, lapis 3 tutup dokumentasi dan tulis ulang dari ingatan.
4. **Dokumentasi adalah referensi saat macet.** Anda tidak perlu menamatkannya, dan Anda tidak perlu menghafalnya.
5. **Kalau ketemu hal baru yang menarik, catat di `sandbox/parkir.md` dan lanjutkan.** Isinya tidak dibaca sebelum hari ke-10.

### Tangga bantuan saat macet

Naik satu anak tangga hanya setelah anak tangga sebelumnya gagal. Batasi waktu **20 menit** per anak tangga.

| Tangga | Tindakan |
|---|---|
| 1 | Baca pesan error dari baris **paling bawah** ke atas. Salin baris kuncinya ke catatan |
| 2 | Cari satu bagian di dokumentasi yang terkait (lihat peta di bawah), baca hanya itu |
| 3 | Tanya AI dengan format: *"Saya mencoba X. Prediksi saya Y. Hasilnya Z. Pesan error: ... Beri petunjuk dulu, jangan kode lengkap."* |
| 4 | Minta kode. Setelah itu, **tutup dan tulis ulang sendiri dari ingatan**, lalu bandingkan |

Catat setiap kali Anda sampai di tangga 4 di `sandbox/jurnal.md`. Itu bukan kegagalan, melainkan daftar konsep yang perlu diulang besok pagi.

---

## 1. Dua tempat kerja: sandbox dan repo

> Kalau tujuan file ini hanya supaya **saya mengerti**, taruh di **sandbox**.
> Kalau file ini akan **dipakai demo**, taruh di **repo**.

Sandbox itu kertas buram: boleh berantakan, boleh dihapus, tidak di-commit. Repo itu gambar kerja: rapi, di-commit sering, dan hanya berisi yang akan dipakai.

### Struktur folder

```
proyek/
├─ sandbox/                       # TIDAK di-commit (boleh git terpisah, opsional)
│  ├─ .venv/                      # satu venv bersama untuk percobaan Python
│  ├─ fase1-http/
│  ├─ fase2-pydantic/
│  ├─ fase3-fastapi/
│  ├─ fase4-psycopg/
│  ├─ fase6-typescript/
│  ├─ ipc-ping/                   # mini Electron (Hari 4-5)
│  ├─ query-polling/              # mini React Query (Hari 6)
│  ├─ jurnal.md                   # catatan harian
│  └─ parkir.md                   # hal menarik yang ditunda
└─ schema-matcher/                # REPO git (struktur lengkap ada di rekap bagian 3)
   ├─ api-mock/
   ├─ desktop/
   ├─ docs/
   └─ scripts/
```

### Persiapan satu kali

```bash
mkdir -p proyek/sandbox proyek/schema-matcher
cd proyek/schema-matcher
git init
mkdir -p api-mock/app api-mock/data/uploads docs scripts
touch api-mock/app/__init__.py
```

`.gitignore` di `schema-matcher/`:

```
.venv/
__pycache__/
*.pyc
api-mock/data/uploads/
node_modules/
out/
dist/
.env
```

Venv terpisah:

```bash
# sandbox
cd proyek/sandbox && python -m venv .venv && source .venv/bin/activate
pip install pydantic             # Windows: .venv\Scripts\activate

# repo (nanti, Hari 1)
cd ../schema-matcher/api-mock && python -m venv .venv && source .venv/bin/activate
pip install "fastapi[standard]"
```

### Cara memindahkan ilmu dari sandbox ke repo

1. Pahami konsep di sandbox sampai prediksi Anda mulai benar.
2. **Tutup file sandbox.** Tulis versi final di repo **dari ingatan**.
3. Buntu lebih dari 10 menit: boleh mengintip file sandbox, lalu tutup lagi dan lanjutkan.
4. **Jangan salin-tempel.** Menulis ulang dari ingatan adalah latihan recall.

### Aturan commit di repo

- Satu commit per langkah selesai, pesan singkat: `feat: models.py`, `feat: GET /submissions`, `test: roundtrip upload`.
- Jangan commit kode yang gagal dijalankan, kecuali diberi awalan `wip:`.
- Selesai hari = ada minimal satu commit.

---

## 2. Fase 1: HTTP (setengah hari)

**Tempat:** sandbox (`sandbox/fase1-http/`). Tabel kontrak di akhir ke repo.

### Yang dipelajari

| Baca | Lewati |
|---|---|
| MDN *An overview of HTTP*: bagian yang menjelaskan klien-server, request, response | Caching, cookies, proxy, HTTP/2 dan HTTP/3, protokol upgrade |
| MDN *HTTP messages*: struktur request dan response (start line, headers, body) | Sejarah versi HTTP, detail kompresi |
| Referensi status code: hanya 200, 201, 202, 204, 400, 404, 409, 413, 415, 422, 500 | Seluruh daftar status code |

### File di sandbox

| File | Isi |
|---|---|
| `prediksi.md` | tabel: perintah, prediksi, hasil, benar/salah |
| `raw1.py` | GET mentah lewat `socket` |
| `raw2.py` | POST JSON mentah, `Content-Length` dihitung sendiri |
| `catatan.md` | ringkasan dengan kata sendiri |

### Latihan (urutan)

A (anatomi lewat `curl -i`/`-v`), C (status code), D (POST JSON dan peran `Content-Type`), E (multipart), F (request mentah, lalu rusakkan dengan sengaja tiga cara). Latihan B boleh dilewati. Perintah lengkap ada di jawaban Fase 1 sebelumnya; tulis prediksi sebelum setiap perintah.

### Ke repo

`docs/kontrak-awal.md`: tabel "situasi → method + path → status sukses → catatan" (enam baris, dari latihan G).

### Selesai kalau

Anda bisa menulis dari halaman kosong satu request dan satu response lengkap dalam 3 menit, dan menjawab: beda 200/201/202/404/422, serta kenapa upload memakai multipart.

---

## 3. Fase 2: Pydantic (setengah hari)

**Tempat:** percobaan di sandbox, hasil akhir di repo.

### Peta dokumentasi Pydantic

Sidebar *Concepts* punya halaman berikut. Hanya lima yang disentuh.

| Halaman | Keputusan | Yang dibaca |
|---|---|---|
| **Models** | **Baca (sebagian)** | lihat tabel bagian Models di bawah |
| **Fields** | **Baca (sebagian)** | default value, `Field(ge=, le=, description=)`, constraint dasar |
| **Types** | **Skim** | hanya bagian `datetime`, `Enum`, `Literal` |
| **Serialization** | **Baca (sebagian)** | `model_dump()`, `mode="json"`, `model_dump_json()`; lewati serializer khusus |
| **JSON Schema** | **Skim** | hanya `model_json_schema()` dan melihat hasilnya |
| Unions | Lewati | `X \| None` sudah ada di Models |
| JSON | Lewati | `model_validate_json` sudah ada di Models |
| Alias | Lewati | keputusan: `snake_case` di seluruh API |
| Configuration | Lewati | hanya `extra="forbid"`, sudah ada di bagian *Extra data* |
| Validators | Lewati | tidak ada validator khusus di MVP |
| Dataclasses | Lewati | |
| Forward Annotations | Lewati | |
| Strict Mode | Lewati | |
| Type Adapter | Lewati | |
| Validation Decorator | Lewati | |
| Conversion Table | **Referensi** | buka hanya saat percobaan 4 mengejutkan Anda |
| Settings Management | Lewati | |
| Performance | Lewati | |
| Experimental | Lewati | |

### Halaman *Models*: bagian per bagian

Daftar bagian ada di kolom kanan halaman ("On this page").

| Bagian | Keputusan | Catatan |
|---|---|---|
| Overview (TL;DR, The long version) | **Baca** | model sebagai kelas dengan field bertipe |
| Basic model usage (Model methods and properties) | **Baca** | `model_dump`, `model_json_schema`, dan kawan-kawan |
| Data conversion | **Baca** | kenapa `"2024"` bisa menjadi `2024` |
| Extra data | **Baca** | `extra="forbid"` |
| Nested models | **Baca** | `Proposal` berisi `SchemaCard` |
| Validating data | **Baca, tapi hanya dua poin** | `model_validate()` dan `model_validate_json()`. **Lewati** `model_validate_strings()`, *Creating models without validation*, dan *Defining a custom `__init__()`* |
| Error handling | **Baca** | `ValidationError`, `e.errors()`: `loc`, `msg`, `type` |
| Cyclic references | Lewati | |
| Rebuilding model schema | Lewati | |
| Arbitrary class instances | Lewati | baris DB dari `psycopg` berbentuk dict, jadi `model_validate(dict)` sudah cukup |
| Model copy | Lewati | |
| Generic models | Lewati | |
| Dynamic model creation | Lewati | |
| RootModel and custom root types | Lewati | |
| Faux immutability dan bagian di bawahnya | Lewati | |

### Kartu lima konsep inti

Tulis ulang ini dari ingatan di `sandbox/fase2-pydantic/kartu.md`.

1. `class X(BaseModel)` dengan field bertipe adalah satu-satunya cara mendefinisikan bentuk data.
2. `x: str | None` artinya **wajib diisi tetapi boleh null**. `x: str | None = None` artinya **opsional**.
3. `Enum` dan `Literal` membatasi pilihan nilai.
4. `Field(ge=0, le=1)` membatasi rentang; `Field(description=...)` muncul di `/docs`.
5. `ValidationError.errors()` memberi tahu **field mana** (`loc`) dan **kenapa** (`msg`, `type`).

### Sembilan percobaan (sandbox)

Satu file per percobaan: `p01_valid.py` ... `p09_schema.py`. Tulis prediksi sebagai komentar di atas file sebelum dijalankan.

| # | Percobaan |
|---|---|
| 1 | `ColumnInfo(name="x", data_type="number")` yang valid |
| 2 | `data_type="angka"`: tangkap `ValidationError`, cetak `e.errors()` |
| 3 | `similarity=1.5` pada model dengan `Field(ge=0, le=1)` |
| 4 | `years=["2024"]` lalu `years=["abc"]`: apa yang terjadi? |
| 5 | `Verdict("duplicate")` vs `Verdict("dup")`; bandingkan dengan `Literal` |
| 6 | `model_dump()` vs `model_dump(mode="json")` vs `model_dump_json()` pada objek berisi `datetime` |
| 7 | `matched: EntryRef \| None` tanpa default: wajib diisi atau tidak? |
| 8 | Kirim field ekstra; lalu `ConfigDict(extra="forbid")` dan ulangi |
| 9 | Cetak `Submission.model_json_schema()` dan baca hasilnya |

### Ke repo (Hari 1)

| File | Isi |
|---|---|
| `api-mock/app/models.py` | seluruh model (rekap, lampiran A) |
| `api-mock/app/fixtures.py` | dua data contoh: satu `enrichment`, satu `needs_review` dengan `matched=None` |
| `api-mock/app/main.py` | `/health`, `/submissions`, `/submissions/{id}` dengan data dari fixtures |

Jalankan dengan `fastapi dev app/main.py` lalu buka `http://127.0.0.1:8000/docs`.

### Selesai kalau

Skor matriks Fase 2 minimal 10 dari 12, dan Anda bisa menunjuk `Proposal` di `/openapi.json` lalu menjelaskan di mana `matched` bisa bernilai `null`.

---

## 4. Fase 3: FastAPI inti (1 hari)

**Tempat:** eksperimen di `sandbox/fase3-fastapi/`; endpoint produk langsung di repo.

### Peta dokumentasi FastAPI

Judul halaman bisa sedikit berbeda antar versi; carilah yang paling mirip.

| Baca | Dipakai untuk |
|---|---|
| *First Steps* | menjalankan aplikasi, `/docs` |
| *Path Parameters* | `/submissions/{id}` |
| *Query Parameters* | filter dan halaman di daftar |
| *Request Body* | model Pydantic sebagai body (`DecisionRequest`) |
| *Response Model - Return Type* | tipe return sebagai response model |
| *Response Status Code* | `202`, `204` |
| *Request Files* dan *Request Forms and Files* | `UploadFile` + field `sheet` |
| *Handling Errors* | `HTTPException`, format error seragam |
| *Dependencies* (halaman pengantar saja) | koneksi DB di Fase 4 |
| *Testing* | `TestClient` |
| *Metadata and Docs URLs* | judul, versi, `tags` |
| *Response Headers* (Advanced User Guide) | header `Location` pada 202 |
| *Custom Response* (bagian `FileResponse`) | unduh file mentah |

| Lewati dulu | Alasan |
|---|---|
| Cookie dan Header Parameters | tidak dipakai |
| Security, OAuth2 | belum ada autentikasi di MVP |
| CORS | klien adalah main process Electron, bukan browser |
| Middleware, Background Tasks, WebSockets | tidak dipakai |
| SQL (Relational) Databases | kita pakai `psycopg`, bukan SQLModel |
| Bigger Applications | satu `main.py` cukup untuk MVP |
| Bagian Advanced lain | tidak dipakai |

### Eksperimen di sandbox

| File | Eksperimen |
|---|---|
| `a_hello.py` | `/health`, jalankan, buka `/docs` |
| `b_params.py` | path vs query parameter; kirim tipe salah dan lihat 422 |
| `c_body.py` | `POST` dengan model, kirim body salah |
| `d_upload.py` | `UploadFile`, balas nama dan ukuran file |
| `e_errors.py` | `HTTPException(404)` dan bentuk `{"detail": ...}` |

### Ke repo (Hari 2 dan 3)

Daftar endpoint dan urutannya ada di bagian 8 (rencana per hari).

### Selesai kalau

Anda menjawab dari ingatan: apa yang terjadi bila body tidak cocok dengan model, dan di mana respons 422 itu dibuat.

---

## 5. Fase 4: PostgreSQL dengan psycopg (setengah hari)

**Tempat:** sandbox untuk mencoba koneksi, repo untuk `db.py` dan seed.

### Peta dokumentasi psycopg 3

| Baca | Lewati |
|---|---|
| *Basic module usage* (connect, cursor, execute) | Async API |
| *Passing parameters to SQL queries* | COPY, server-side cursor, pipeline mode |
| *Row factories* (`dict_row`) | Row factory lain |
| *Connection pools* (`psycopg_pool`): pengenalan | Konfigurasi pool lanjutan |
| Adaptasi JSON (`Jsonb`) | Tipe khusus lain |

### Aturan yang tidak boleh dilanggar

**Parameter SQL selalu lewat `%s` dan tuple, jangan f-string.**

```python
cur.execute("SELECT * FROM submissions WHERE id = %s", (sid,))   # benar
cur.execute(f"SELECT * FROM submissions WHERE id = '{sid}'")     # SALAH: celah SQL injection
```

### Persiapan PostgreSQL

Kalau belum terpasang, cara tercepat:

```bash
docker run --name pg-schema -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
pip install "psycopg[binary,pool]"
```

### Sandbox

`sandbox/fase4-psycopg/`: `a_connect.py` (SELECT 1), `b_insert.py` (insert dan baca kembali), `c_dict.py` (`row_factory=dict_row`, lalu `Submission.model_validate(row)`).

### Repo

| File | Isi |
|---|---|
| `api-mock/app/db.py` | pool koneksi, fungsi `get_conn()` untuk `Depends` |
| `api-mock/scripts/seed.py` atau `sql/001_schema.sql` | tabel `submissions` + data contoh |

Tabel `submissions` ada di rekap, bagian 6. **Tidak ada tabel katalog di MVP.**

### Selesai kalau

`GET /submissions` membaca dari PostgreSQL, dan Anda menjelaskan kenapa koneksi dibuat per request lewat dependency, bukan variabel global.

---

## 6. Fase 5: OpenAPI dan job palsu (1 hari)

**Tempat:** repo. Sandbox hanya untuk membaca `openapi.json`.

### Yang dipelajari

| Baca | Lewati |
|---|---|
| learn.openapis.org *Introduction*: `paths`, `components/schemas`, `$ref` | Spesifikasi lengkap, security schemes, callbacks, webhooks |
| FastAPI *Metadata and Docs URLs* | |
| FastAPI `generate_unique_id_function` (agar `operationId` rapi, misalnya `listSubmissions`) | |
| README `openapi-typescript` | `openapi-generator` dan generator SDK lain |

### Latihan

1. Ekspor `openapi.json` dengan skrip kecil `scripts/export_openapi.py`.
2. **Baca sendiri** bagian `paths` dan `components/schemas`. Tunjukkan di mana `Proposal.matched` bisa `null`.
3. Jalankan `openapi-typescript` untuk menghasilkan `api-types.ts`.
4. Tambah satu field kecil di `Proposal`, ekspor ulang, generate ulang, dan lihat `git diff`. Itulah "satu kontrak" bekerja.

### Job palsu

Tahap dihitung dari selisih waktu (`now - uploaded_at`), tanpa thread atau tabel job. Contoh pemetaan: 0–2 dtk `reading_sheet`, 2–4 `building_meaning`, 4–6 `building_schema_card`, 6–8 `embedding`, 8–10 `judging`, lalu `done`.

### Selesai kalau

`api-types.ts` ada di repo, dan Anda menjawab: kalau menambah satu field di `Proposal`, apa yang berubah otomatis dan apa yang harus diubah manual.

---

## 7. Fase 6 sampai 8: TypeScript, Electron, React Query

### TypeScript (malam Hari 3–4, sandbox)

| Baca (TypeScript Handbook) | Lewati |
|---|---|
| *TypeScript for JavaScript Programmers* | Classes, Decorators, Mixins |
| *The Basics*, *Everyday Types* | Namespaces, declaration merging |
| *Narrowing* | Referensi `tsconfig` mendalam |
| *Object Types* | JSX mendalam |
| *Generics* (dasar saja) | Conditional dan mapped types |
| *Utility Types* (skim: `Pick`, `Omit`, `Partial`) | |

Latihan di `sandbox/fase6-typescript/`:
1. Ubah satu fungsi dari toy project JS Anda ke TS dengan `"strict": true`.
2. Tulis `type Verdict = 'new_dataset' | ...` dan sebuah fungsi `describe(p: Proposal)` yang menangani `matched: EntryRef | null`. Perhatikan apa yang dikatakan compiler bila Anda lupa kasus `null`.
3. Beda `unknown` dan `any`: tulis satu contoh untuk masing-masing.

### Electron TS (Hari 4–5)

Pakai **dokumentasi resmi Electron**, bukan buku 2018, untuk bagian IPC dan keamanan.

| Baca | Lewati |
|---|---|
| *Process Model* | Native menu, tray, protokol kustom |
| *Context Isolation* | Notifikasi dan auto-update (nanti) |
| *Inter-Process Communication* (pola `invoke`/`handle`) | |
| *Security* (skim daftar periksa) | |
| dokumentasi `electron-vite` *Getting Started* | |

Mini-proyek **sandbox `ipc-ping/`** (30–45 menit): satu tombol di renderer, yang memanggil `window.api.ping()`, lewat preload, ke handler di main yang mengembalikan `"pong"`. Setelah ini jalan, barulah ulangi polanya di repo.

### React Query (Hari 6)

| Baca (TanStack Query) | Lewati |
|---|---|
| *Overview*, *Quick Start* | Infinite queries, SSR, prefetching |
| *Queries* dan *Query Keys* | Optimistic updates |
| *Mutations* | Devtools |
| *Query Invalidation* | |
| `refetchInterval` untuk polling | |

Mini-proyek **sandbox `query-polling/`**: fungsi palsu yang mengembalikan progres naik 0→100, ditampilkan lewat `useQuery` dengan `refetchInterval`, berhenti saat `done`.

---

## 8. Rencana per hari: sandbox vs repo

Hari 10 selalu cadangan. Kalau sebuah hari meleset, geser ke hari berikutnya, jangan memotong konsep.

### Hari 1

| Waktu | Tempat | Pekerjaan |
|---|---|---|
| Pagi | sandbox | Fase 1: A, C, D, E, F + `prediksi.md` |
| Siang | sandbox | Fase 2: sembilan percobaan |
| Sore | repo | `models.py`, `fixtures.py`, `main.py` dari ingatan; `fastapi dev`; tur `/docs` |
| Malam | repo | commit; `kontrak-awal.md`; isi `jurnal.md` |

Selesai kalau: `curl /health` jalan, model tampil di `/docs`, ada satu commit.

### Hari 2

| Tempat | Pekerjaan |
|---|---|
| sandbox | Fase 3 eksperimen `a` sampai `e`; Fase 4 `a` sampai `c` |
| repo | siapkan PostgreSQL; tabel `submissions` + seed; `GET /submissions` dan `GET /submissions/{id}` dari DB; format error seragam; tiga tes pytest |

Selesai kalau: tiga tes lulus, 404 dan 422 berbentuk `{code, message}`.

### Hari 3 (hari terberat; urutan prioritas)

1. `POST /submissions`: validasi, simpan ke disk, hitung SHA-256, baris DB, respons `202` + `Location`.
2. `GET /jobs/{id}` (job berbasis waktu) dan `scenarios.py`.
3. `POST /submissions/{id}/decision` dengan aturan 409.
4. Ekspor OpenAPI dan generate `api-types.ts`.
5. `GET /submissions/{id}/file` dan uji pulang-pergi.
6. `POST /dev/reset`.

Kalau waktu habis, yang dipotong **pertama** adalah nomor 6, lalu 5. Nomor 1 sampai 4 wajib. Sisa dikerjakan di Hari 4 pagi.

### Hari 4

| Tempat | Pekerjaan |
|---|---|
| sandbox | TypeScript (tiga latihan); `ipc-ping/` |
| repo | scaffold `desktop/` dengan electron-vite (react-ts), `strict`; layar **Pengaturan**: "Uji koneksi" memanggil `/health` lewat main |

### Hari 5

| Tempat | Pekerjaan |
|---|---|
| repo | `shared/ipc-contract.ts`, preload bertipe, `api-client.ts` di main; layar **Daftar submission** dengan state loading, kosong, dan error |

### Hari 6

| Tempat | Pekerjaan |
|---|---|
| sandbox | `query-polling/` |
| repo | **Unggah**: dialog file, pratinjau SheetJS, hash SHA-256, `submissions.create`; **Progres** dengan polling |

### Hari 7 dan 8

Hari 7: **Review**: tata letak, data, diff skema masuk vs entri yang cocok. Hari 8: aksi Terima dan Tolak, tangani 409 di UI, dan **tulis skrip demo**.

### Hari 9 dan 10

Hari 9: loading, kosong, error; data dummy realistis; latihan demo dua kali berturut-turut. Hari 10: cadangan, build dengan `electron-builder`, pasang di luar mode dev.

---

## 9. Jurnal dan recall

### `sandbox/jurnal.md` (5 menit setiap malam)

```
## 2026-11-__ (Hari N)
- Dikerjakan:
- Prediksi benar / total:
- Macet di (dan tangga bantuan tertinggi yang dipakai):
- Satu hal yang belum saya pahami:
- Besok pagi saya akan recall:
```

### Recall pagi (8:00–8:30)

Halaman kosong, tanpa melihat catatan. Tulis apa yang Anda ingat dari kemarin, lalu bandingkan. Hal yang terlewat masuk ke jurnal sebagai "belum paham".

---

## 10. Template meminta bantuan

### Meminta petunjuk (tangga 3)

```
Saya sedang [fase/hari]. Saya mencoba: [apa].
Kode saya: [tempel potongan pendek].
Prediksi saya: [apa yang saya kira terjadi].
Hasilnya: [apa yang terjadi, termasuk baris error terakhir].
Yang sudah saya coba: [daftar].
Beri petunjuk atau pertanyaan pemandu dulu, jangan kode lengkap.
```

### Meminta kode (tangga 4)

```
Saya sudah mencoba selama [N] menit dan buntu di [bagian].
Tolong tunjukkan kode minimal untuk [bagian itu saja], beserta penjelasan
satu kalimat per baris. Setelah itu saya akan menulis ulang sendiri.
```

---

## 11. Daftar "boleh diabaikan dulu"

Pydantic: Alias, Validators, Dataclasses, Strict Mode, Type Adapter, Settings Management, Generic models, RootModel.
FastAPI: Security, CORS, Middleware, Background Tasks, WebSockets, SQL databases, Bigger Applications.
Electron: tray, menu, auto-update, protokol kustom.
React Query: infinite queries, SSR, optimistic updates.
Umum: ORM, Docker Compose multi-service, CI/CD, autentikasi.

Semua ini boleh dibuka setelah demo.

---

## 12. Checklist progres

### Fase 1
- [ ] `prediksi.md` terisi, hit-rate > 70% pada putaran kedua
- [ ] `raw1.py` dan `raw2.py` jalan; tiga kerusakan terdiagnosis
- [ ] Tabel kontrak awal di `docs/kontrak-awal.md`
- [ ] Skor rubrik ≥ 13 (kriteria 3, 5, 7 bernilai 2)

### Fase 2
- [ ] Sembilan percobaan selesai, prediksi tercatat
- [ ] `kartu.md` ditulis dari ingatan
- [ ] `models.py`, `fixtures.py`, `main.py` di repo, `/docs` terbuka
- [ ] Skor rubrik ≥ 10 (kriteria 2, 3, 6 bernilai 2)

### Fase 3 dan 4
- [ ] `UploadFile` menyimpan file dan membalas ukuran
- [ ] `GET /submissions` dari PostgreSQL
- [ ] Parameter SQL selalu lewat `%s`
- [ ] Tiga tes pytest lulus

### Fase 5
- [ ] `openapi.json` terekspor, `api-types.ts` ter-generate
- [ ] Uji pulang-pergi identik (SHA-256 cocok)
- [ ] Job berbasis waktu bekerja tanpa thread

### Fase 6 sampai 8
- [ ] `ipc-ping/` berjalan di sandbox
- [ ] `query-polling/` berjalan di sandbox
- [ ] Rantai penuh jalan di repo: Pengaturan → `/health`
- [ ] Layar 1 sampai 5 berfungsi dengan data mock
