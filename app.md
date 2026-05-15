# StrideChain iOS App — API & Architecture Spec

## API

**Base URL**: `https://api-stride.hipporasy.dev`

Sessions are cookie-based. The app must send cookies with every request (`HTTPCookieStorage.shared` handles this automatically with `URLSession`).

---

### Endpoints

#### `GET /health`
Liveness check.

**Response** `200`:
```json
{ "ok": true }
```

---

#### `GET /auth/strava`
Starts the Strava OAuth flow. Open this URL in `ASWebAuthenticationSession` or `SFSafariViewController`. The server will redirect through Strava and back. On success the session cookie is set and the browser can be dismissed.

**Flow**:
1. Open `https://api-stride.hipporasy.dev/auth/strava` in `ASWebAuthenticationSession`
2. Strava redirects to `/auth/strava/callback` (handled server-side)
3. Server sets session cookie and redirects to your app's custom URL scheme (e.g. `stridechainapp://auth/success`)
4. App receives callback, dismisses the session, session cookie is now active

> The server does **not** return a token — it uses a server-side session cookie. All subsequent requests must include cookies.

---

#### `GET /runs`
Returns the authenticated user's recent Strava runs.

**Auth**: Requires active session (cookie).

**Response** `200`:
```json
[
  {
    "activityId": 123456789,
    "name": "Morning Run",
    "distance": 5243,
    "movingTime": 1680,
    "startDate": "2024-01-15T07:30:00Z",
    "startDateLocal": "2024-01-15T15:30:00+08:00"
  }
]
```

| Field | Type | Notes |
|-------|------|-------|
| `activityId` | `Int` | Pass to `/mint` |
| `distance` | `Double` | Metres |
| `movingTime` | `Int` | Seconds |
| `startDate` | `String` | ISO 8601 UTC |

**Response** `401`: Not authenticated — trigger Strava login.

---

#### `POST /mint`
Mints a StrideBadge NFT for a run. The NFT is sent to the provided wallet address; the server pays gas.

**Auth**: Requires active session (cookie).

**Request body**:
```json
{
  "activityId": 123456789,
  "walletAddress": "0xYourWalletAddress"
}
```

**Response** `200`:
```json
{
  "txHash": "0xabc...",
  "tokenId": 42
}
```

**Error responses**:
| Status | Meaning |
|--------|---------|
| `400` | Activity does not belong to authenticated user |
| `409` | Badge already minted for this activity |
| `422` | Activity is not a run |
| `500` | Transaction failed |

---

## SwiftUI Architecture

Use **Apple Native patterns** with `@Observable` — no third-party state management.

### Layer structure

```
App
├── AppState (@Observable)          — auth state, navigation
├── RunsViewModel (@Observable)     — fetches + holds run list
└── MintViewModel (@Observable)     — drives mint action for one run
```

### Key patterns

**`@Observable` ViewModels** — place business logic here, never in view bodies:
```swift
@Observable
final class RunsViewModel {
    var runs: [Run] = []
    var isLoading = false
    var error: Error?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            runs = try await APIClient.shared.fetchRuns()
        } catch {
            self.error = error
        }
    }
}
```

**Property wrapper decision tree**:
- `@State` — view-owned local state (e.g. sheet shown, text field)
- `@Environment` — app-wide objects passed from root (e.g. `AppState`)
- `@Bindable` — when you need a `$binding` into an `@Observable` object
- Plain `let` / `var` — when the view just reads a model value

**Async loading** — use `.task` for initial loads, `Task {}` for button actions:
```swift
.task { await viewModel.load() }              // cancelled on disappear
Button("Mint") { Task { await vm.mint() } }  // user-triggered
```

### Auth flow

```swift
@Observable
final class AppState {
    var isAuthenticated = false

    func checkSession() async {
        isAuthenticated = (try? await APIClient.shared.health()) != nil
        // Better: add GET /me endpoint that 401s when not authenticated
    }

    func startStravaLogin() {
        // Open ASWebAuthenticationSession with /auth/strava URL
        // On callbackURL matching your scheme, set isAuthenticated = true
    }
}
```

Root view:
```swift
@main
struct StrideChainApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            if appState.isAuthenticated {
                RunsView()
            } else {
                LoginView()
            }
        }
        .environment(appState)
    }
}
```

### Mint flow

1. User selects a run from the list
2. App prompts for their wallet address (text field or WalletConnect)
3. Tap "Mint Badge" → `MintViewModel.mint(activityId:walletAddress:)`
4. Show progress → on success show `txHash` and `tokenId`
5. Handle `409` specifically: "Badge already minted for this run"

```swift
@Observable
final class MintViewModel {
    var isMinting = false
    var result: MintResult?
    var errorMessage: String?

    func mint(activityId: Int, walletAddress: String) async {
        isMinting = true
        defer { isMinting = false }
        do {
            result = try await APIClient.shared.mint(
                activityId: activityId,
                walletAddress: walletAddress
            )
        } catch APIError.alreadyMinted {
            errorMessage = "Badge already minted for this run."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
```

### APIClient skeleton

```swift
final class APIClient {
    static let shared = APIClient()
    private let base = URL(string: "https://api-stride.hipporasy.dev")!

    // URLSession uses HTTPCookieStorage.shared by default — sessions work automatically
    private let session = URLSession.shared

    func fetchRuns() async throws -> [Run] {
        let (data, response) = try await session.data(from: base.appending(path: "/runs"))
        if (response as! HTTPURLResponse).statusCode == 401 { throw APIError.unauthenticated }
        return try JSONDecoder().decode([Run].self, from: data)
    }

    func mint(activityId: Int, walletAddress: String) async throws -> MintResult {
        var req = URLRequest(url: base.appending(path: "/mint"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(MintRequest(activityId: activityId, walletAddress: walletAddress))
        let (data, response) = try await session.data(for: req)
        switch (response as! HTTPURLResponse).statusCode {
        case 200: return try JSONDecoder().decode(MintResult.self, from: data)
        case 409: throw APIError.alreadyMinted
        case 422: throw APIError.notARun
        default:  throw APIError.serverError
        }
    }
}
```

### Models

```swift
struct Run: Codable, Identifiable {
    var id: Int { activityId }
    let activityId: Int
    let name: String
    let distance: Double       // metres
    let movingTime: Int        // seconds
    let startDate: Date
}

struct MintRequest: Codable {
    let activityId: Int
    let walletAddress: String
}

struct MintResult: Codable {
    let txHash: String
    let tokenId: Int
}

enum APIError: Error {
    case unauthenticated
    case alreadyMinted
    case notARun
    case serverError
}
```

---

## User Flow

```
Launch
  └─ AppState.checkSession()
       ├─ authenticated → RunsView
       │     ├─ .task → RunsViewModel.load() → list of runs
       │     └─ tap run → RunDetailView
       │           ├─ enter wallet address
       │           └─ tap Mint → MintViewModel.mint() → success / error
       └─ not authenticated → LoginView
             └─ "Connect Strava" → ASWebAuthenticationSession(/auth/strava)
                   └─ callback → isAuthenticated = true → RunsView
```

---

## Notes

- **Wallet address**: Collect as a plain text field. Validate the `0x…` format client-side before sending. For a better UX, integrate WalletConnect or prompt once and persist in Keychain.
- **Sessions**: The server uses in-memory sessions (will add Redis later). If the server restarts, the user will need to re-authenticate.
- **Date decoding**: Set `JSONDecoder().dateDecodingStrategy = .iso8601` when decoding `Run`.
- **No HTTPS certificate pinning needed** for MVP, but add it before App Store submission.
