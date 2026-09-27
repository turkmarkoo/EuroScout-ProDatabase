# Private Dragons Data connection

The online website reads a separate Firebase owner feed after DragonsHub sign-in. Only the active administrator account `markoturk.scouting@gmail.com` may read or write `dragonsDataSnapshots` and `dragonsDataState`. This rule applies to metadata and every compressed chunk. Scouting notes and existing shared datasets use their existing permissions.

On the PC, start Dragons Data with RUN-PRIVATE.ps1 and open http://127.0.0.1:8767/firebase. Sign in using the existing DragonsHub owner account, then click **Connect and sync**. After each successful local collection, the helper syncs the latest validated live feed. Reload EuroScout to load that feed. The collector still runs on the PC; Firebase does not run scrapers.

The password is used for sign-in and never saved. The refresh session exists only in the helper process memory; reconnect after restarting the helper. The publisher uses your Firebase user session, not an administrator service key, so Firestore rules remain enforced. A failed sync preserves the previous cloud snapshot and the new local data. Finished chunks and metadata are written before the current pointer changes, with a check against simultaneous updates.

Current-season leagues from Dragons Data appear separately from the historical EuroScout leagues. Only accepted, published, live box scores contribute to player statistics; unaccepted games may appear as fixtures/results without player lines. No name-only player merge into historical scouting records is performed. Unknown statistics remain unknown. Fresh owner feed data is not written into public static files, browser persistent storage, or the shared scouting snapshot. The core is copied before the private feed is added, preventing scouting saves from sharing those statistics.

Existing public statistics files are not removed by this integration. Other users retain their existing access; they do not gain access to the new owner-only feed. Firebase rules must preserve the existing rules, and no overlapping broad allow rule may cover these two new collections. See https://firebase.google.com/docs/firestore/security/rules-conditions.

Verification: node tests/dragons-feed.cjs checks non-owner/no-session access and isolation from shared state. Collector tests check live-only accepted export, unknown statistics, owner account checks, and atomic publication.
