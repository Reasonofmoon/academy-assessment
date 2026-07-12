# Generated item bank

AI(IRT 모드)가 생성한 문항이 검수 상태와 함께 저장됩니다.

| status | 의미 |
|--------|------|
| `pending` | 교사 검수 대기 |
| `approved` | 사용 승인 |
| `quarantine` | 격리(부적합) |

- 파일: `items.json` (런타임 read/write)
- UI: `/review`
- API: `GET/POST /api/items`, `PATCH /api/items/[id]`, `POST /api/items/bulk`

Vercel 등 서버리스에서는 디스크가 휘발성일 수 있습니다. 장기 운영 시 Supabase 등으로 이전하세요.
