/** Analytics collect stub — accepts tracker POSTs so they don't 404 */
export async function POST() {
  return Response.json({ ok: true });
}
