# App links from analysis

## First slice

Siftory currently shows URLs copied literally from the source and names cited by the analysis. Add an optional lookup to the saved analysis view for app names and App Store or Google Play URLs. Preserve source quotes and separate them from catalog results. Let the reader review the limited names and listing IDs before one lookup. Send only those terms or IDs to the selected stores.

Use Apple's documented public search and lookup API for iOS. Display its listing titles and publishers so different apps with similarly spelled names remain distinguishable. Use the canonical public Google Play listing for a package ID explicitly present in the source. Offer a user-opened Google Play search for name-only Android discovery. Google disallows automated access to its public search route. Keep other quoted URLs as source links.

No new key, dependency, or model request is required. Lookup results remain with the open item view for this slice. Restrict server requests to fixed store endpoints and bound input, response size, concurrent requests, and timeout. Do not send transcript text or follow redirects. Check mismatched titles, unavailable listings, and network failures with synthetic store responses.
