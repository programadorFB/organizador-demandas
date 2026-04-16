const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function safeInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

(async () => {
  const client = await pool.connect();
  try {
    // 1. Reclassify unknowns
    const unknowns = await client.query("SELECT id, payload FROM kommo_webhook_events WHERE event_type = 'unknown'");
    for (const row of unknowns.rows) {
      const p = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      let newType = 'unknown';
      if (p.unsorted) newType = `unsorted_${Object.keys(p.unsorted)[0]}`;
      else if (p.talk) newType = `talk_${Object.keys(p.talk)[0]}`;
      else if (p.message) newType = `message_${Object.keys(p.message)[0]}`;
      if (newType !== 'unknown') {
        await client.query("UPDATE kommo_webhook_events SET event_type = $1 WHERE id = $2", [newType, row.id]);
      }
    }
    console.log(`Reclassified ${unknowns.rows.length} unknown events`);

    // 2. Load user map
    const userMap = await client.query("SELECT kommo_user_id, kommo_user_name, seller_id FROM kommo_user_map");
    const sellerByKommo = {};
    userMap.rows.forEach(r => { sellerByKommo[r.kommo_user_id] = r; });

    // 3. Clear new tables
    await client.query("DELETE FROM kommo_daily_metrics");
    await client.query("DELETE FROM kommo_messages");
    await client.query("DELETE FROM kommo_conversations");
    await client.query("DELETE FROM kommo_unsorted_leads");

    // 4. First pass: process LEAD events to populate leads_cache with modified_user_id
    const allEvents = await client.query("SELECT id, event_type, payload, created_at FROM kommo_webhook_events ORDER BY id");
    console.log(`Processing ${allEvents.rows.length} events...`);

    for (const evt of allEvents.rows) {
      const p = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
      if (p.leads) {
        for (const action of Object.keys(p.leads)) {
          const items = p.leads[action];
          if (!Array.isArray(items)) continue;
          for (const lead of items) {
            const leadId = safeInt(lead.id);
            if (!leadId) continue;
            const rawResp = safeInt(lead.responsible_user_id) || 0;
            const modifiedBy = safeInt(lead.modified_user_id) || 0;
            const kommoUserId = rawResp || modifiedBy;
            await client.query(
              `INSERT INTO kommo_leads_cache (kommo_lead_id, kommo_user_id, pipeline_id, status_id, revenue, lead_created_at, lead_updated_at, synced_at)
               VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7), NOW())
               ON CONFLICT (kommo_lead_id) DO UPDATE SET kommo_user_id = CASE WHEN $2 != 0 THEN $2 ELSE kommo_leads_cache.kommo_user_id END, synced_at=NOW()`,
              [leadId, kommoUserId, safeInt(lead.pipeline_id) || 0, safeInt(lead.status_id) || 0, parseFloat(lead.price || 0), lead.created_at || 0, lead.updated_at || 0]
            );
          }
        }
      }
    }
    console.log('Lead cache updated with modified_user_id');

    // 5. Second pass: process unsorted, talk, message with seller cross-reference
    let counts = { unsorted: 0, talk: 0, msg: 0 };
    for (const evt of allEvents.rows) {
      const p = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;

      // UNSORTED
      if (p.unsorted) {
        for (const action of Object.keys(p.unsorted)) {
          const items = p.unsorted[action];
          if (!Array.isArray(items)) continue;
          for (const u of items) {
            let contactName = null, contactPhone = null, contactId = null;
            let leadId = null, leadName = null, sourceName = null, sellerKommoId = null;

            if (u.data) {
              if (u.data.contacts && u.data.contacts[0]) {
                const c = u.data.contacts[0];
                contactName = c.name || c.first_name || null;
                contactId = safeInt(c.id);
                if (c.custom_fields) {
                  for (const fid of Object.keys(c.custom_fields)) {
                    const f = c.custom_fields[fid];
                    if (f.code === 'PHONE' && f.values) {
                      const vals = Object.values(f.values);
                      if (vals[0]) contactPhone = vals[0].value;
                    }
                  }
                }
              }
              if (u.data.leads && u.data.leads[0]) {
                leadId = safeInt(u.data.leads[0].id);
                leadName = u.data.leads[0].name || null;
              }
            }
            if (u.source_data) sourceName = u.source_data.source_name || null;
            let initialMessage = null;
            if (u.source_data && u.source_data.data && Array.isArray(u.source_data.data)) {
              initialMessage = u.source_data.data.map(d => d.text).filter(Boolean).join('\n');
            }

            // Cross-reference seller from lead cache
            if (leadId) {
              const cached = await client.query('SELECT kommo_user_id FROM kommo_leads_cache WHERE kommo_lead_id = $1', [leadId]);
              if (cached.rows[0]?.kommo_user_id && cached.rows[0].kommo_user_id !== 0) {
                sellerKommoId = cached.rows[0].kommo_user_id;
              }
            }

            await client.query(
              `INSERT INTO kommo_unsorted_leads
                (uid, kommo_lead_id, lead_name, contact_id, contact_name, contact_phone, source, source_name, category, pipeline_id, initial_message, seller_kommo_id, event_action, webhook_event_id, created_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
              [u.uid, leadId, leadName, contactId, contactName, contactPhone,
               u.source || null, sourceName, u.category || null, safeInt(u.pipeline_id),
               initialMessage, sellerKommoId, action, evt.id, evt.created_at]
            );
            counts.unsorted++;
          }
        }
      }

      // TALK
      if (p.talk) {
        for (const action of Object.keys(p.talk)) {
          const items = p.talk[action];
          if (!Array.isArray(items)) continue;
          for (const t of items) {
            const talkId = safeInt(t.talk_id);
            if (!talkId) continue;

            let sellerKommoId = null;
            const leadId = safeInt(t.entity_id);
            if (leadId) {
              const cached = await client.query('SELECT kommo_user_id FROM kommo_leads_cache WHERE kommo_lead_id = $1', [leadId]);
              if (cached.rows[0]?.kommo_user_id && cached.rows[0].kommo_user_id !== 0) {
                sellerKommoId = cached.rows[0].kommo_user_id;
              }
            }

            await client.query(
              `INSERT INTO kommo_conversations
                (talk_id, chat_id, lead_id, contact_id, origin, is_read, is_in_work, rate, seller_kommo_id, webhook_event_id, first_seen_at, updated_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
              ON CONFLICT (talk_id) DO UPDATE SET
                is_read = EXCLUDED.is_read, is_in_work = EXCLUDED.is_in_work,
                rate = EXCLUDED.rate, seller_kommo_id = COALESCE(NULLIF(EXCLUDED.seller_kommo_id, 0), kommo_conversations.seller_kommo_id), updated_at = EXCLUDED.updated_at`,
              [talkId, t.chat_id || null, leadId, safeInt(t.contact_id),
               t.origin || null, t.is_read === '1' || t.is_read === true,
               t.is_in_work === '1' || t.is_in_work === true,
               safeInt(t.rate), sellerKommoId, evt.id,
               t.created_at ? new Date(parseInt(t.created_at) * 1000) : evt.created_at,
               t.updated_at ? new Date(parseInt(t.updated_at) * 1000) : evt.created_at]
            );
            counts.talk++;
          }
        }
      }

      // MESSAGE
      if (p.message) {
        for (const action of Object.keys(p.message)) {
          const items = p.message[action];
          if (!Array.isArray(items)) continue;
          for (const m of items) {
            let sellerKommoId = null;
            const leadId = safeInt(m.entity_id) || safeInt(m.element_id);
            if (leadId) {
              const cached = await client.query('SELECT kommo_user_id FROM kommo_leads_cache WHERE kommo_lead_id = $1', [leadId]);
              if (cached.rows[0]?.kommo_user_id && cached.rows[0].kommo_user_id !== 0) {
                sellerKommoId = cached.rows[0].kommo_user_id;
              }
            }
            if (!sellerKommoId && m.talk_id) {
              const conv = await client.query('SELECT seller_kommo_id FROM kommo_conversations WHERE talk_id = $1', [parseInt(m.talk_id)]);
              if (conv.rows[0]?.seller_kommo_id) sellerKommoId = conv.rows[0].seller_kommo_id;
            }

            await client.query(
              `INSERT INTO kommo_messages
                (message_id, talk_id, chat_id, lead_id, contact_id, author_name, author_type, text, msg_type, origin, seller_kommo_id, webhook_event_id, message_at, created_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
              [m.id || null, safeInt(m.talk_id), m.chat_id || null,
               leadId, safeInt(m.contact_id),
               m.author ? m.author.name : null, m.author ? m.author.type : null,
               m.text || null, m.type || null, m.origin || null,
               sellerKommoId, evt.id,
               m.created_at ? new Date(parseInt(m.created_at) * 1000) : null,
               evt.created_at]
            );
            counts.msg++;
          }
        }
      }
    }

    console.log(`\n=== RESULTADO ===`);
    console.log(`Unsorted: ${counts.unsorted}, Talks: ${counts.talk}, Messages: ${counts.msg}`);

    // 6. Show final report with sellers
    console.log('\n=== EVENTOS COM VENDEDOR RESPONSAVEL ===\n');

    const report = await client.query(`
      SELECT 'LEAD' as tipo, we.id, we.event_type,
        payload->'leads'->'update'->0->>'id' as ref_id,
        COALESCE(um1.kommo_user_name, 'ID ' || COALESCE(payload->'leads'->'update'->0->>'modified_user_id','?')) as vendedor
      FROM kommo_webhook_events we
      LEFT JOIN kommo_user_map um1 ON um1.kommo_user_id = CAST(NULLIF(payload->'leads'->'update'->0->>'modified_user_id', '') AS INTEGER)
      WHERE we.event_type = 'lead_update'
      UNION ALL
      SELECT 'UNSORTED', we.id, we.event_type,
        ul.contact_name || ' (' || COALESCE(ul.contact_phone,'-') || ')',
        COALESCE(um2.kommo_user_name, 'Nao identificado')
      FROM kommo_webhook_events we
      JOIN kommo_unsorted_leads ul ON ul.webhook_event_id = we.id
      LEFT JOIN kommo_user_map um2 ON um2.kommo_user_id = ul.seller_kommo_id
      UNION ALL
      SELECT 'TALK', we.id, we.event_type,
        'Talk #' || c.talk_id || ' Lead ' || c.lead_id,
        COALESCE(um3.kommo_user_name, 'Nao identificado')
      FROM kommo_webhook_events we
      JOIN kommo_conversations c ON c.webhook_event_id = we.id
      LEFT JOIN kommo_user_map um3 ON um3.kommo_user_id = c.seller_kommo_id
      UNION ALL
      SELECT 'MSG', we.id, we.event_type,
        m.author_name || ': ' || COALESCE(substring(m.text, 1, 40), '-'),
        COALESCE(um4.kommo_user_name, 'Nao identificado')
      FROM kommo_webhook_events we
      JOIN kommo_messages m ON m.webhook_event_id = we.id
      LEFT JOIN kommo_user_map um4 ON um4.kommo_user_id = m.seller_kommo_id
      ORDER BY id, tipo
    `);

    report.rows.forEach(r => {
      console.log(`#${r.id} [${r.tipo}] ${r.event_type} | ${r.ref_id} -> ${r.vendedor}`);
    });

    // Resumo por vendedor
    console.log('\n=== RESUMO POR VENDEDOR ===\n');
    const summary = await client.query(`
      SELECT
        COALESCE(um.kommo_user_name, 'Nao mapeado') as vendedor,
        COUNT(DISTINCT ul.id) as unsorted_leads,
        COUNT(DISTINCT c.id) as conversas,
        COUNT(DISTINCT m.id) as mensagens
      FROM kommo_user_map um
      LEFT JOIN kommo_unsorted_leads ul ON ul.seller_kommo_id = um.kommo_user_id
      LEFT JOIN kommo_conversations c ON c.seller_kommo_id = um.kommo_user_id
      LEFT JOIN kommo_messages m ON m.seller_kommo_id = um.kommo_user_id
      GROUP BY um.kommo_user_name
      ORDER BY unsorted_leads DESC
    `);
    console.table(summary.rows);

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    pool.end();
  }
})();
