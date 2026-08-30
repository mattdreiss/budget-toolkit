import { installFetchInterceptor } from "../infrastructure/everydollar/fetchInterceptor.js";

// Runs in the page's own JS world at document_start, before EveryDollar's app
// code has had a chance to fetch anything. This is the whole of this bundle —
// it deliberately carries no domain or UI code, since none of it could reach
// the content script anyway.
installFetchInterceptor();
