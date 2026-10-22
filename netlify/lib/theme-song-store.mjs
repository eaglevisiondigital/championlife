import { randomUUID } from 'node:crypto';

export class CounterError extends Error {
  constructor(status) { super('Counter request unavailable'); this.status = status; }
}

export class CounterStore {
  constructor(pool, installation, environment) { Object.assign(this, { pool, installation, environment }); }
  async run(kind, id, networkHash) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '3000ms'");
      const config = await client.query('SELECT id,environment,enabled FROM theme_song.installation WHERE singleton');
      if (config.rows.length !== 1 || config.rows[0].id !== this.installation || config.rows[0].environment !== this.environment || !config.rows[0].enabled) throw new CounterError(503);
      const plays = async () => (await client.query("SELECT total::text AS plays FROM theme_song.totals WHERE kind='play'")).rows[0];
      if (!kind) { const result = await plays(); await client.query('COMMIT'); return result; }
      // Transactional admission: bounded cardinality, no raw IP / UA / referrer retention.
      const rate = await client.query(`INSERT INTO theme_song.rate_windows(network_hash,minute,starts,events)
        VALUES ($1,date_trunc('minute',clock_timestamp()),$2,$3)
        ON CONFLICT(network_hash,minute) DO UPDATE SET starts=theme_song.rate_windows.starts+excluded.starts,events=theme_song.rate_windows.events+excluded.events
        RETURNING starts,events`, [networkHash, kind === 'start' ? 1 : 0, kind === 'start' ? 0 : 1]);
      if (rate.rows[0].starts > 20 || rate.rows[0].events > 120) throw new CounterError(429);
      await client.query("DELETE FROM theme_song.sessions WHERE expires_at <= clock_timestamp()");
      await client.query("DELETE FROM theme_song.rate_windows WHERE minute < clock_timestamp() - interval '10 minutes'");
      let session = id ? (await client.query('SELECT id,clock_timestamp() - started_at >= interval \'5 seconds\' AS mature FROM theme_song.sessions WHERE id=$1 AND expires_at>clock_timestamp()', [id])).rows[0] : null;
      if (kind === 'start') {
        if (!session) session = (await client.query('INSERT INTO theme_song.sessions(id) VALUES ($1) RETURNING id', [randomUUID()])).rows[0];
      } else {
        if (!session) throw new CounterError(401);
        if (kind === 'play' && !session.mature) throw new CounterError(425);
        const inserted = await client.query('INSERT INTO theme_song.events(session_id,kind) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING kind', [session.id, kind]);
        if (inserted.rowCount) await client.query('UPDATE theme_song.totals SET total=total+1 WHERE kind=$1', [kind]);
      }
      const result = { ...await plays(), session: session.id };
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
}
