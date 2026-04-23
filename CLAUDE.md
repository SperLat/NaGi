# Cedar / Nagi — Claude Instructions

## REGLA ABSOLUTA: No acciones destructivas

Nunca ejecutar comandos que destruyan o reviertan datos, incluso si el razonamiento interno lo sugiere como "la mejor opción":

- **Supabase**: NUNCA `db reset`. Para aplicar migraciones pendientes: `npx supabase migration up`
- **Git**: NUNCA `reset --hard`, `push --force`, `clean -f`, `branch -D` sin instrucción explícita del usuario
- **Filesystem**: NUNCA `rm -rf`, `rmdir /s`, `del /f /s` en directorios del proyecto
- **SQL**: NUNCA ejecutar `DROP TABLE`, `DROP DATABASE`, `TRUNCATE` directamente

**Alternativa siempre disponible:**
| Acción destructiva | Alternativa segura |
|---|---|
| `supabase db reset` | `npx supabase migration up` |
| `git reset --hard` | `git stash` o nuevo commit |
| `rm -rf dir` | Mostrar qué se eliminaría, pedir confirmación explícita |
| `DROP TABLE` | Mostrar la query, no ejecutarla |

Si hay duda sobre si una acción es destructiva — no ejecutarla. Preguntar primero.

---

## Stack

- **Mobile**: Expo SDK 54, React Native, NativeWind v4, expo-router
- **Backend**: Supabase local (`npx supabase start` desde raíz)
- **AI**: Claude claude-sonnet-4-6 con prompt caching
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
