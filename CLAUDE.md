# Cedar / Nagi — Claude Instructions

## REGLA ABSOLUTA: No acciones destructivas

Nunca ejecutar comandos que destruyan o reviertan datos, incluso si el razonamiento interno lo sugiere como "la mejor opción":

- **Supabase**: NUNCA `db reset`. NUNCA `supabase stop` (incluso con `--no-backup` — el flag es engañoso, en esta versión del CLI desmonta el volumen de Postgres y borra los datos locales). Para reiniciar solo edge functions: `docker restart supabase_edge_runtime_Cedar`. Para detener limpiamente con backup: `pnpm db:safe-stop`.
- **Git**: NUNCA `reset --hard`, `push --force`, `clean -f`, `branch -D` sin instrucción explícita del usuario
- **Filesystem**: NUNCA `rm -rf`, `rmdir /s`, `del /f /s` en directorios del proyecto
- **SQL**: NUNCA ejecutar `DROP TABLE`, `DROP DATABASE`, `TRUNCATE` directamente

**Alternativa siempre disponible:**
| Acción destructiva | Alternativa segura |
|---|---|
| `supabase db reset` | `npx supabase migration up` |
| `supabase stop` (riesgo de perder datos del volumen) | `pnpm db:safe-stop` (toma backup automático antes) |
| Reiniciar solo edge functions | `docker restart supabase_edge_runtime_Cedar` |
| Cambiar `config.toml` y aplicar | Editar archivo + `docker restart supabase_edge_runtime_Cedar` (NO `supabase stop && start`) |
| `git reset --hard` | `git stash` o nuevo commit |
| `rm -rf dir` | Mostrar qué se eliminaría, pedir confirmación explícita |
| `DROP TABLE` | Mostrar la query, no ejecutarla |

**Backup manual cuando quieras:** `pnpm db:backup` → escribe `supabase/.backups/auto-<timestamp>.sql`.

**Restaurar:** `docker exec -i supabase_db_Cedar psql -U postgres -d postgres < supabase/.backups/auto-XXXX.sql`

Si hay duda sobre si una acción es destructiva — no ejecutarla. Preguntar primero.

---

## Stack

- **Mobile**: Expo SDK 54, React Native, NativeWind v4, expo-router
- **Backend**: Supabase local (`npx supabase start` desde raíz)
- **AI**: Claude `claude-opus-4-7` (chat + digest, 1M context) y `claude-haiku-4-5` (clasificación) con prompt caching
- **Comandos**: Siempre `npx supabase` (no global), `pnpm` en apps/mobile

## Para iniciar el entorno

```powershell
# Terminal 1 — desde D:\Server\cedar
npx supabase start
npx supabase migration up   # solo si hay migraciones nuevas

# Terminal 2
cd apps\mobile
pnpm start --clear
```
