<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep screen-share capture and publication settings separate from camera defaults in the shared live quality module, so text clarity survives camera codec and frame-rate changes.
- Application completion uses the shared validation module in the form and server validator; partial saves remain permitted so abandoned applications are retained.
- Application notifications mount once per admin or commercial layout and poll an authenticated narrow projection; a silent initial baseline and completed-ID tracker prevent historical or duplicate alerts.
- The shared applications view lives outside route modules so both admin and commercial routes reuse it safely under route code splitting.
- Commercial staff use a separate authenticated commercial layout; server checks allow only admin/SDR/closer, and only admins assign commercial roles.
- Commercial login is a public entry using existing accounts, with server-validated commercial access before navigation; the standard auth entry forwards commercial return destinations without modifying the managed authenticated gate.
- Manual commercial access is granted atomically through an authenticated database function using catalog feature mappings and an audit entry, independent of billing.
- Commercial creation and manual grants share duration validation; lifetime uses NULL expiry. Club UI rechecks own grants and unmounts protected content at effective expiry, while has_feature enforces timestamps on every authorization and preserves independent valid grants.
- Commercial home, members, applications and team use separate leaf routes within the commercial shell; shared query options and team presentation live outside routes to preserve code splitting and existing permission boundaries.
- Route pending states use shared page skeletons, with commercial leaf-specific shapes and a shell fallback, to preserve visual structure without changing authentication or data loading.
- Platform account CRUD uses separate commercial-authorized (admin/SDR/closer) server functions, auth email as the canonical address and server-side self/staff/ongoing-billing deletion guards; commercial access grants remain available to SDR/closers separately.
- New-member onboarding shares a server-only credential creation and fixed welcome sender across manual creation and payment fulfilment; credentials never enter app storage, logs, audits or client responses, and existing accounts are never reset by purchases.
- Commercial member dialogs use the shared portalled Dialog component so animated page transforms cannot position overlays outside the viewport.
- Commercial presentation remaps semantic admin tokens within its shell and portalled dialog contents; shared admin palette changes stay in global CSS so business logic and permission boundaries remain unchanged.
- Lead closure shares amount validation between UI and server and persists EUR cents; sale celebration and recorded bell playback occur only after the server returns the saved lead.
- Sale bell animation follows actual audio playback state and restarts for each repetition, so local and team celebrations stay synchronized without independent animation timers.
- Paid-sale bells share a commercial-authorized narrow polling feed across admin/commercial shells, baseline silently and deduplicate source IDs; later MMpay cycles exclude cycle one to avoid double announcements.
- Staff call schedules live on the lead and update atomically with status and ownership; the shared authenticated own-calls query feeds home and header reminders independently of the applications history window.
- Own sales use persisted closure author and timestamp, not current lead ownership; a database trigger snapshots BRL commission from EUR sale amounts, and the authenticated paginated query scopes results to the caller independently of application history limits. Historical sales use the recorded responsible person when closure authorship was unavailable.
- Paddle zero-value verification for an existing subscription only links gateway billing; it must not emit payment/recovery events or extend access because verification is not revenue.
- Recording admission checks storage after checking active egress and returns host-visible warnings when full; preserve existing credential-independent fallbacks when storage reads fail.

- Staff credential updates and email confirmation require admin authorization, existing SDR/closer roles and password-free audits; preserve avatars, roles and global signup settings.
- Resolve Lovable avatar asset URLs directly, never as private bucket paths.
- Automated tests must never leave rows in the live lead/application tables; use a rolled-back transaction or a throwaway row deleted in the same test, because staff read that list as real business pipeline.
- Lead presentation shares an ownership predicate for inactive contact/status actions and resolves sale attribution from the recorded closer, falling back to the responsible person only for legacy rows; this keeps admin/commercial presentation consistent without changing server authorization.
- Only SDR/admin schedule calls and must pick a closer; the lead ownership moves to that closer while the scheduler is stored separately, so closers get the agenda/reminders and "Marcado por" stays accurate.
- MMpay edits retain link/code/product and prior payments, creating Stripe prices only on amount changes for legacy links. Deletion retains covers shared by duplicates.
- MMpay card/MB WAY checkout goes through Viva.com Smart Checkout (order refs stored as vvo_<orderCode>); payment status is always re-checked against Viva, never trusted from the browser or webhook body.
- MMpay subscriptions are managed by MM Club (mmpay_subscriptions + per-attempt mmpay_subscription_charges); Viva only processes charges via the first payment's recurring transaction, and every recurring charge must send the MMpay sourceCode plus EUR currency or Viva bills the "Default" source and fails with "Transaction failed". Duplicate protection: unique initial order code, atomic claim RPC with locked_until, and one processing/paid charge per cycle; a failed attempt never blocks a manual retry because each retry takes the next attempt number.
- Every paid MMpay payment grants 6 months of club features once per payment (purchase grant keyed by payment id), creating/inviting the buyer account by email; access failures are logged and never block payment confirmation.
- Admin financial overview normalizes settled EUR MMpay payments and later recurring cycles into revenue once; cycle one stays in the initial payment source, and MMpay does not alter legacy subscription MRR or churn.
- Financial sale categories use MMpay link billing type for initial payments, subscription type for later cycles, and subscription association for legacy billing; trials remain separate from both sale totals.
- External MMpay sale notifications enqueue transactionally on settled payment transitions and later recurring cycles, using the shared retry queue and stable sale IDs; external failures never roll back payment or club access.
- Authenticated external sale delivery uses manual redirects and rejects non-success responses; Workers do not support redirect:error, and credentials must never follow redirects.
- CRM and Novawebinar use independent MMpay sale jobs and a shared settled-sale reader, so one destination cannot block the other; CRM URL credentials and upstream bodies must never enter error logs.
- Commercial goals (monthly revenue, SDR daily calls, closer daily closes) live per month in commercial_goals; only admins write them, commercial staff read, and SDR daily progress counts leads by call_booked_at set when a call is first booked.
- MMpay link deletion is a soft delete (deleted_at) and payments FK is RESTRICT, so sales history is never lost.

- Load the dashboard’s latest podcast episode once in its parent and share it with the hero and episode block to keep both highlights consistent without duplicate requests.
- Keep dashboard hero selection in the browser-safe hero-selection module; the dashboard shell overlays its topbar using scoped hero tokens so other pages and themes remain unchanged.
- Share account and club switching through AccountMenu avatar triggers in the member shell; reuse existing product access checks and selection without a separate sidebar selector.
- External Legacy buyers activate via public /ativar; the allow-list lives in a server-only module and grants use a fixed source id so they stay idempotent.
- Card-update email suppression uses a shared policy at both legacy and notification-engine delivery boundaries, including forced resends, so billing processing remains untouched.
- Billing revocations must remain scoped to the subscription source and ID; independent manual access survives failed payments, suspension and cancellation without changing collection processing.
- Lesson file playback attaches HLS through a browser-only dynamic hls.js fallback when native support is absent; destroy the stream on navigation so Legacy playlists work across browsers without stale playback.
