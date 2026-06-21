// GET /api/auth/status — public: has the deployment been initialized with an admin yet?
import { route, send } from "../_lib/http.js";
import { countUsers } from "../_lib/db.js";
export default route({ GET: async (_req, res) => { send(res, 200, { initialized: (await countUsers()) > 0 }); } });
