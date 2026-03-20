# ReturnFlow ROBOT Return Service SPEC

## 1. Service Overview

### 1.1 Goal
`ReturnFlow` is a web service that accepts a return request without login, sends the request to a backend, forwards it to a ROS-connected robot judgment system, and shows users the current processing status and final decision on the web.

### 1.2 MVP Scope
- No-login return request creation
- Input fields:
  - `object_name`
  - `return_reason`
- Request ID issuance after submission
- Status tracking page
- Mock backend/ROS flow for frontend-first development
- Responsive UI for desktop and mobile

### 1.3 Non-Goals for MVP
- Real ROS connection
- Real authentication
- Real payment/refund processing
- Admin console implementation
- Photo/video upload

### 1.4 Product Principles
- Simple first: users should complete a request in under 1 minute
- Status transparency: show what is happening now and what happens next
- Replaceable integration: ROS connection must be loosely coupled
- Operations-ready: history/log structure should support admin tracing later

## 2. Overall User Flow

### 2.1 Main User Journey
1. User lands on the landing page
2. User moves to the return request page
3. User enters `object_name` and `return_reason`
4. Frontend validates the form
5. Backend creates the request and returns `request_id`
6. Backend stores the request and sends it to the ROS integration layer
7. Robot system processes the request and reports status/result
8. User sees progress and final decision on the status page

### 2.2 UX Flow by Page
- Landing page
  - Clearly explains: "Submit a return request and track robot judgment status"
  - Primary CTA: `반품 접수 시작`
  - Secondary CTA: `상태 확인`
- Return request page
  - Object name input
  - Return reason textarea
  - Inline validation
  - Sample helper copy
- Submission complete page
  - Request accepted
  - Request ID shown
  - Buttons to track status or start another request
- Status page
  - Current status badge
  - Progress stepper
  - Latest status message
  - Final decision card if completed
  - Guidance for `추가 확인 필요` or `오류 발생`

## 3. System Architecture

### 3.1 Components
- Frontend
  - Landing, request form, receipt complete, status pages
  - Polling-based status sync for MVP
- Backend API server
  - Request creation API
  - Request lookup API
  - Status/history persistence
  - ROS bridge adapter call
- ROS integration layer
  - Receives normalized job payload from backend
  - Publishes to ROS topic/service/action
  - Receives robot progress/result callback
- Robot judgment process
  - Executes inspection flow
  - Returns intermediate and final states
- Result storage
  - Return request table
  - Status history table
  - Final decision result fields
- Status update channel
  - MVP: polling
  - Upgrade path: SSE or WebSocket

### 3.2 Reference Architecture
```text
[Frontend]
   |
   | POST /api/returns
   v
[Backend API]
   |
   | persist request + create job
   v
[Database]
   |
   | send normalized payload
   v
[ROS Integration Layer]
   |
   | publish / invoke robot process
   v
[Robot Judgment Process]
   |
   | callback / webhook / queue event
   v
[Backend API]
   |
   | update status history + result
   v
[Frontend polling/SSE/WebSocket]
```

## 4. State Machine Design

### 4.1 User-Facing Statuses
- `RECEIVED` / 접수됨
- `ROS_DISPATCHED` / ROS 전달 완료
- `ROBOT_JUDGING` / 로봇 판정 진행중
- `NEEDS_REVIEW` / 추가 확인 필요
- `APPROVED` / 승인
- `REJECTED` / 반려
- `ERROR` / 오류 발생

### 4.2 Internal Operational Statuses
- `WEB_SUBMIT_SUCCESS`
- `WEB_SUBMIT_FAILED`
- `BACKEND_SAVE_SUCCESS`
- `BACKEND_SAVE_FAILED`
- `ROS_SEND_SUCCESS`
- `ROS_SEND_FAILED`
- `ROBOT_RESPONSE_SUCCESS`
- `ROBOT_RESPONSE_FAILED`

### 4.3 Allowed Transitions
```text
DRAFT
 -> RECEIVED
 -> ERROR

RECEIVED
 -> ROS_DISPATCHED
 -> ERROR

ROS_DISPATCHED
 -> ROBOT_JUDGING
 -> ERROR

ROBOT_JUDGING
 -> APPROVED
 -> REJECTED
 -> NEEDS_REVIEW
 -> ERROR

NEEDS_REVIEW
 -> APPROVED
 -> REJECTED
 -> ERROR
```

### 4.4 Status Messaging Policy
- `RECEIVED`
  - "반품 요청이 접수되었습니다."
- `ROS_DISPATCHED`
  - "검수 요청이 로봇 시스템으로 전달되었습니다."
- `ROBOT_JUDGING`
  - "로봇이 현재 반품 상태를 판정 중입니다."
- `NEEDS_REVIEW`
  - "자동 판정만으로는 결정하기 어려워 추가 확인이 필요합니다."
- `APPROVED`
  - "반품 요청이 승인되었습니다."
- `REJECTED`
  - "반품 요청이 반려되었습니다."
- `ERROR`
  - "처리 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요."

## 5. Page Structure

### 5.1 Routes
- `/`
  - Landing page
- `/request`
  - Return request form page
- `/receipt/:requestId`
  - Submission complete page
- `/status`
  - Request ID lookup page
- `/status/:requestId`
  - Status detail page

### 5.2 Page Goals
- Landing
  - Explain product and processing flow
  - Direct users to action fast
- Request
  - Remove friction and clarify required inputs
- Receipt
  - Reassure success and preserve request ID
- Status detail
  - Show current state, final result, and next action

## 6. Core Components

### 6.1 Shared UI Components
- Header / top navigation
- Hero section
- CTA button group
- Section title
- Info card
- Status badge
- Progress stepper
- Timeline/history list
- Message panel
- Form field
- Validation hint
- Result summary card

### 6.2 Feature Components
- Return request form
- Request created summary
- Request ID search form
- Live status board
- Final decision block
- Additional review guidance panel
- Error recovery panel

## 7. Data Model Draft

### 7.1 Return Request Entity
| Field | Type | Required | Description |
|---|---|---:|---|
| `request_id` | string | Y | Public tracking ID |
| `object_name` | string | Y | Name of returned object |
| `return_reason` | text | Y | User-entered reason |
| `status` | enum | Y | Current user-facing status |
| `robot_status` | enum | N | Robot processing status |
| `final_decision` | enum/null | N | `APPROVED`, `REJECTED`, `NEEDS_REVIEW` |
| `decision_reason` | text/null | N | Human-readable explanation |
| `judge_note` | text/null | N | Robot or operator note |
| `confidence` | decimal/null | N | Robot decision confidence |
| `error_code` | string/null | N | System error code |
| `created_at` | datetime | Y | Request creation time |
| `updated_at` | datetime | Y | Last state change |
| `completed_at` | datetime/null | N | Finalized time |
| `source_channel` | string | Y | `web` |
| `tracking_token` | string/null | N | Optional anonymous access token |

### 7.2 Status History Entity
| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | uuid | Y | Primary key |
| `request_id` | string | Y | Linked request |
| `status` | enum | Y | User-facing status |
| `internal_event` | enum/null | N | Operational event |
| `message` | text | Y | Status detail message |
| `actor_type` | enum | Y | `WEB`, `BACKEND`, `ROS`, `ROBOT`, `ADMIN` |
| `metadata_json` | json | N | Payload snapshot, debug values |
| `created_at` | datetime | Y | Event time |

### 7.3 Final Decision Model
| Field | Type | Description |
|---|---|---|
| `request_id` | string | Linked request |
| `final_decision` | enum | Approved / Rejected / Needs review |
| `decision_reason` | text | Main reason shown to user |
| `confidence` | decimal | Optional model confidence |
| `judge_note` | text | Internal or user-safe note |
| `review_required` | boolean | Whether human review is needed |
| `finalized_at` | datetime | Final decision time |

### 7.4 Admin-Ready Traceability
- Keep full status history
- Store robot payload snapshot version
- Separate user-facing message and internal debug metadata
- Preserve error code and retry count
- Add `review_required` so human review can be introduced later without redesign

## 8. API Design Draft

### 8.1 Create Return Request
`POST /api/returns`

Request:
```json
{
  "object_name": "무선 이어폰 케이스",
  "return_reason": "충전이 되지 않고 LED가 깜빡이지 않습니다."
}
```

Response `201`:
```json
{
  "request_id": "RET-20260321-8F2A1",
  "status": "RECEIVED",
  "message": "반품 요청이 접수되었습니다.",
  "created_at": "2026-03-21T10:00:00+09:00",
  "next_poll_after_ms": 3000
}
```

Validation rules:
- `object_name`: 2-60 chars
- `return_reason`: 10-500 chars
- whitespace-only input rejected

### 8.2 Get Return Status
`GET /api/returns/:requestId`

Response:
```json
{
  "request_id": "RET-20260321-8F2A1",
  "object_name": "무선 이어폰 케이스",
  "return_reason": "충전이 되지 않고 LED가 깜빡이지 않습니다.",
  "status": "ROBOT_JUDGING",
  "robot_status": "INSPECTING",
  "final_decision": null,
  "decision_reason": null,
  "judge_note": "외관 및 기본 전원 응답 확인 중",
  "confidence": null,
  "error_code": null,
  "created_at": "2026-03-21T10:00:00+09:00",
  "updated_at": "2026-03-21T10:00:18+09:00",
  "history": [
    {
      "status": "RECEIVED",
      "message": "반품 요청이 접수되었습니다.",
      "created_at": "2026-03-21T10:00:00+09:00"
    },
    {
      "status": "ROS_DISPATCHED",
      "message": "검수 요청이 로봇 시스템으로 전달되었습니다.",
      "created_at": "2026-03-21T10:00:05+09:00"
    }
  ]
}
```

### 8.3 Anonymous Status Search
`GET /api/returns?request_id=RET-20260321-8F2A1`

Use case:
- User enters request ID manually on status lookup page

### 8.4 ROS Callback Endpoint
`POST /api/internal/ros/returns/:requestId/events`

Request:
```json
{
  "request_id": "RET-20260321-8F2A1",
  "robot_status": "INSPECTING",
  "status": "ROBOT_JUDGING",
  "final_decision": null,
  "decision_reason": null,
  "judge_note": "컨베이어 진입 및 카메라 정렬 완료",
  "confidence": null,
  "error_code": null,
  "event_at": "2026-03-21T10:00:18+09:00"
}
```

### 8.5 Operational APIs for Future
- `GET /api/admin/returns`
- `GET /api/admin/returns/:requestId/history`
- `POST /api/admin/returns/:requestId/review`

## 9. ROS Integration Interface Draft

### 9.1 Coupling Strategy
- Backend should not depend directly on ROS-specific message structures in its core domain
- Introduce an adapter layer:
  - `ReturnJobService`
  - `RosReturnBridge`
  - `RobotResultIngestService`
- Backend emits normalized job payload
- ROS adapter converts that payload into topic/service/action format

### 9.2 Outbound Payload to ROS
```json
{
  "request_id": "RET-20260321-8F2A1",
  "object_name": "무선 이어폰 케이스",
  "return_reason": "충전이 되지 않고 LED가 깜빡이지 않습니다.",
  "created_at": "2026-03-21T10:00:00+09:00",
  "robot_status": "PENDING",
  "final_decision": null,
  "decision_reason": null,
  "confidence": null,
  "judge_note": null,
  "error_code": null
}
```

### 9.3 Inbound Payload from ROS
```json
{
  "request_id": "RET-20260321-8F2A1",
  "robot_status": "COMPLETED",
  "status": "APPROVED",
  "final_decision": "APPROVED",
  "decision_reason": "포장 손상과 충전 불량이 확인되어 반품 승인",
  "confidence": 0.93,
  "judge_note": "카메라 분석 및 기본 전원 테스트 통과",
  "error_code": null,
  "event_at": "2026-03-21T10:01:02+09:00"
}
```

### 9.4 Timeout and Retry Policy
- ROS send timeout: 3-5 seconds
- ROS job ack timeout: 10 seconds
- Robot result timeout: configurable by product type, default 5 minutes
- Retry send: max 2 attempts with exponential backoff
- On repeated failure:
  - internal status: `ROS_SEND_FAILED`
  - user-facing status: `ERROR`
  - message: "자동 검수 연결에 문제가 발생했습니다. 운영팀 확인 후 상태가 갱신될 수 있습니다."

### 9.5 When to Use `NEEDS_REVIEW`
- Confidence below threshold
- Reason text too vague to classify
- Object category mismatch
- Sensor capture incomplete
- Robot detects conflicting signals
- Edge cases needing human confirmation

## 10. Web-Backend-ROS Sync Method Comparison

### 10.1 Polling
- How it works
  - Frontend calls status API every few seconds
- Pros
  - Very simple to implement
  - Easy to debug
  - No persistent connection management
- Cons
  - Slightly delayed updates
  - More repeated requests

### 10.2 Server-Sent Events
- How it works
  - Backend keeps one-way stream open to push status changes
- Pros
  - Near real-time
  - Simpler than WebSocket for one-way updates
- Cons
  - More server connection management than polling
  - Reconnect handling needed

### 10.3 WebSocket
- How it works
  - Full duplex connection for push updates
- Pros
  - Real-time
  - Flexible for future admin dashboard
- Cons
  - Most operational complexity
  - Needs connection lifecycle and scaling design

### 10.4 MVP Recommendation
Use `polling` first.

Reason:
- Frontend-first MVP needs predictable behavior
- Easy to mock without backend
- Easy to replace later with SSE
- Status changes are not high-frequency enough to justify WebSocket now

Upgrade path:
- Keep frontend state sync behind a single service interface so polling can later be swapped to SSE/WebSocket

## 11. Design System Direction

### 11.1 Chosen Style
`Neo-brutalism`

Reason:
- Strong block shapes make status-heavy workflows easy to read
- High-contrast UI fits industrial robot-return domain
- Memorable visual identity without requiring complex assets

### 11.2 Color System
- `Ink`: `#111111`
- `Paper`: `#FFF9EF`
- `Signal Blue`: `#5B7CFF`
- `Signal Yellow`: `#FFD84D`
- `Signal Mint`: `#78F0B7`
- `Signal Red`: `#FF6B57`
- `Signal Gray`: `#D7D2C8`

### 11.3 Typography Direction
- Headline: bold geometric sans
- Body: clean readable sans
- Numeric/request ID: monospaced accent

Suggested pairing:
- `Space Grotesk` for headings
- `Pretendard` or `SUIT` for body
- `JetBrains Mono` for IDs/status codes

### 11.4 Component Style
- Buttons
  - Thick border
  - Hard shadow
  - Solid fill
  - Strong hover offset
- Forms
  - Large input height
  - Black border
  - Slight paper-toned background
- Cards
  - Heavy outline
  - Layered offset shadow
  - Simple rectangular geometry
- Status badges
  - Capsule or hard rectangle
  - High contrast background by status

### 11.5 Progress Step Display
- Horizontal stepper on desktop
- Vertical stack on mobile
- Active step highlighted with fill + shadow
- Completed step includes timestamp or check indicator

### 11.6 Page Atmosphere
- Clear industrial workflow tone
- Bold blocks, structured spacing
- Minimal decorative noise
- Slight diagonal/offset accents to avoid generic admin-screen feel

## 12. Frontend Development Priority

### Phase 1
- Global layout and routing
- Landing page
- Request form page

### Phase 2
- Receipt complete page
- Status detail page
- Status badge and stepper UI

### Phase 3
- Mock API
- Mock status transition simulator
- Local persistence for request data

### Phase 4
- Validation polish
- Responsive layout tuning
- Error and edge state messaging

## 13. Backend and ROS Connection Strategy After Frontend

### 13.1 Backend First Integration Order
1. Implement `POST /api/returns`
2. Persist request and history
3. Implement `GET /api/returns/:requestId`
4. Add ROS bridge dispatch job
5. Add ROS callback ingestion endpoint
6. Add admin trace query APIs

### 13.2 Suggested Domain Modules
- `returns`
- `return-history`
- `robot-bridge`
- `decision-results`
- `admin-review`

### 13.3 Safe Evolution Path
- Keep frontend on interface contracts defined in this SPEC
- Use normalized status enums across systems
- Store every transition as history
- Treat ROS as replaceable infrastructure, not core domain logic

## 14. Validation and Operations Policy

### 14.1 Required Inputs
- `object_name`
- `return_reason`

### 14.2 Minimum Validation Rules
- Object name required
- Return reason required
- No whitespace-only input
- Reject excessively short reasons
- Soft warning for vague reasons like:
  - "이상함"
  - "문제 있음"
  - "그냥 반품"

### 14.3 UX for Vague Reasons
- Show helper text:
  - "고장 증상이나 반품 사유를 조금 더 구체적으로 적어주세요."
- Allow submission once minimum length is met, but note that vague input may lead to `추가 확인 필요`

### 14.4 Fallback Policy
- If robot judgment fails:
  - set `ERROR` or `NEEDS_REVIEW` depending on recoverability
- If information is insufficient:
  - set `NEEDS_REVIEW`
- If ROS transport fails repeatedly:
  - set `ERROR`
- If later human review is added:
  - consume the same request/history model without schema redesign

## 15. Sample Content

### 15.1 Object Name Examples
- `무선 이어폰 케이스`
- `로봇 청소기 먼지통`
- `텀블러 뚜껑`
- `블루투스 키보드`

### 15.2 Return Reason Examples
- `전원이 들어오지 않고 충전도 되지 않습니다.`
- `배송 직후 외관에 균열이 확인되었습니다.`
- `버튼이 눌리지 않아 정상 사용이 어렵습니다.`

### 15.3 Final Decision Messages
- Approved:
  - `불량 증상이 확인되어 반품이 승인되었습니다.`
- Rejected:
  - `자동 점검 결과 정상 범위로 확인되어 반품이 반려되었습니다.`
- Needs review:
  - `판정 근거가 충분하지 않아 추가 확인이 필요합니다.`

### 15.4 Error Messages
- `요청 저장 중 문제가 발생했습니다. 다시 시도해 주세요.`
- `로봇 시스템 연결이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.`
- `상태 정보를 불러오지 못했습니다. 요청 ID를 다시 확인해 주세요.`

## 16. Frontend MVP Implementation Decision

For the first implementation:
- Build frontend only
- Use mock API and local state persistence
- Simulate status transitions by elapsed time
- Use polling for the status page
- Keep API contract aligned with this SPEC so backend can replace mocks later
