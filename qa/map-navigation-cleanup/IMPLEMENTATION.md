# MapView exit crash — selection camera lifecycle

The incident was reproduced with real React 19 / React-Leaflet / Leaflet on desktop and phone, using explicit synthetic property data and mock authentication. Idle map exit succeeded; selecting a PIN and then removing MapView triggered `Cannot read properties of undefined (reading '_leaflet_pos')`.

The captured stack points to `MapSelectionCamera.cancel -> Leaflet.stop -> setZoom -> getCenter -> _getMapPanePos`. React-Leaflet's parent MapContainer cleanup calls `map.remove()` before the child camera's passive cleanup. Leaflet remove already stops animations and deletes the map pane. The old child cleanup then called stop on the destroyed instance. The exception during removal escaped the outgoing module into the application error boundary.

The camera now observes the existing public Leaflet unload event. A removed camera never calls stop or focus. Explicit idempotent disposal cancels live movement only, detaches its unload listener, and suppresses subsequent commands. The React effect still cancels its animation frame and now disposes the camera. No exception swallowing, automatic document reload, private Leaflet pane access or global prototype patch is introduced into application code.

Evidence: before.json retains the failing stacks; after.json checks idle, selected PIN, in-flight selection and fractional zoom on both devices. Camera tests include parent-first removal and early frame cancellation. The 76-test affected closure includes module retry and parcel lens regressions. Contract TypeScript and scoped lint passed. Production build uses the committed baseline plus only the three camera files, excluding the unfinished property-enrichment changes in the shared workspace.

This release changes frontend camera lifetime only. Existing Z15 / Z16 / Z17 targets, popup geometry, parcel permissions, privacy, sources, backend, database and report calculations remain unchanged. Browser authentication in automated navigation checks is explicitly mocked; it is not acceptance in the user's real production session.
