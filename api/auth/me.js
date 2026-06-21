// GET /api/auth/me — current session user, or 401.
import { route, send, requireUser, publicUser } from "../_lib/http.js";
export default route({ GET: async (req, res) => { send(res, 200, { user: publicUser(await requireUser(req)) }); } });
