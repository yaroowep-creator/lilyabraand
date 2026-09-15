/*
  Sends a CONFIRMED order to Noest Express.
  Called only from admin.html, only after the store owner clicks
  "تأكيد وإرسال إلى Noest" — never automatically from the storefront.

  Required Netlify environment variables (Site settings → Environment variables):
    NOEST_API_TOKEN  — your Noest Express API token
    NOEST_GUID       — your Noest Express account GUID

  These are kept server-side on purpose: putting them inside admin.html would
  expose them to anyone who opens the page's source code in a browser.

  NOTE: Noest Express does not publish an official public API document, so
  this relays through the same third-party bridge (freeship.dzbuild.com)
  used previously for this project. If Noest later publishes an official
  API, only the `NOEST_ENDPOINT` / request shape below needs to change —
  everything else (env vars, security, admin button) stays the same.
*/
const NOEST_ENDPOINT = "https://freeship.dzbuild.com/api/noest/create-order";

exports.handler = async function(event){
  if(event.httpMethod !== "POST"){
    return { statusCode: 405, body: JSON.stringify({error:"Method not allowed"}) };
  }

  const token = process.env.NOEST_API_TOKEN;
  const guid = process.env.NOEST_GUID;
  if(!token || !guid){
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "NOEST_API_TOKEN / NOEST_GUID غير مضبوطين كمتغيّرات بيئة في Netlify." })
    };
  }

  let order;
  try{ order = JSON.parse(event.body); }
  catch(e){ return { statusCode:400, body: JSON.stringify({error:"بيانات الطلبية غير صالحة"}) }; }

  const payload = {
    api_token: token,
    user_guid: guid,
    reference: order.id || "",
    client: `${order.name||""} ${order.lastname||""}`.trim(),
    phone: order.phone || "",
    adresse: order.commune || "",
    wilaya_id: order.wilayaCode || null,
    wilaya: order.wilaya || "",
    commune: order.commune || "",
    stopdesk: order.deliv === "Stop Desk" ? 1 : 0,
    station_code: (order.office && order.office.label) || "",
    montant: order.total || 0,
    produit: order.product ? order.product.name : "",
    quantite: order.qty || 1,
    remarque: `Couleur: ${order.color||"-"} / Taille: ${order.size||"-"}`
  };

  try{
    const res = await fetch(NOEST_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){
      return { statusCode: res.status, body: JSON.stringify({ error: data.message || "Noest rejected the order", raw: data }) };
    }
    return { statusCode: 200, body: JSON.stringify(data) };
  }catch(err){
    return { statusCode: 502, body: JSON.stringify({ error: "تعذّر الاتصال بخدمة Noest: " + err.message }) };
  }
};
