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
- Platform account CRUD uses separate commercial-authorized (admin/SDR/closer) server functions, invites without auto-confirming email, auth email as the canonical address and server-side self/staff/ongoing-billing deletion guards; commercial access grants remain available to SDR/closers separately.
- Commercial member dialogs use the shared portalled Dialog component so animated page transforms cannot position overlays outside the viewport.
- Commercial presentation remaps semantic admin tokens within its shell and portalled dialog contents; shared admin palette changes stay in global CSS so business logic and permission boundaries remain unchanged.
- Lead closure shares amount validation between UI and server and persists EUR cents; sale celebration and recorded bell playback occur only after the server returns the saved lead.
- Sale bell animation follows actual audio playback state and restarts for each repetition, so local and team celebrations stay synchronized without independent animation timers.
- Staff call schedules live on the lead and update atomically with status and ownership; the shared authenticated own-calls query feeds home and header reminders independently of the applications history window.
- Own sales use persisted closure author and timestamp, not current lead ownership; a database trigger snapshots BRL commission from EUR sale amounts, and the authenticated paginated query scopes results to the caller independently of application history limits. Historical sales use the recorded responsible person when closure authorship was unavailable.
- Paddle zero-value verification for an existing subscription only links gateway billing; it must not emit payment/recovery events or extend access because verification is not revenue.
- Recording admission checks storage after checking active egress and returns host-visible warnings when full; preserve existing credential-independent fallbacks when storage reads fail.

- Commercial email confirmation is an admin-authorized server function restricted to existing SDR/closer accounts and audited; global signup confirmation remains unchanged.
- The shared avatar resolver treats Lovable asset URLs as directly renderable, not private avatar-bucket paths, so team photographs work in account avatars.
- Automated tests must never leave rows in the live lead/application tables; use a rolled-back transaction or a throwaway row deleted in the same test, because staff read that list as real business pipeline.
- Lead presentation shares an ownership predicate for inactive contact/status actions and resolves sale attribution from the recorded closer, falling back to the responsible person only for legacy rows; this keeps admin/commercial presentation consistent without changing server authorization.
- Only SDR/admin schedule calls and must pick a closer; the lead ownership moves to that closer while the scheduler is stored separately, so closers get the agenda/reminders and "Marcado por" stays accurate.
