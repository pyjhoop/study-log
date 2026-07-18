import { useEffect, useState } from "react";
import { CloudUpload, Github } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { emitSessionSaved } from "@/lib/ipc";
import {
  DEFAULT_BACKUP_CONFIG,
  getBackupConfig,
  getLastBackupAt,
  getToken,
  isConfigReady,
  pushBackup,
  restoreBackup,
  saveBackupConfig,
  saveToken,
  type BackupConfig,
} from "@/lib/backup";
import { Section } from "./parts";

/** epoch(초) → 사람이 읽는 로컬 일시. 마지막 백업 시각 표시용. */
function formatWhen(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * GitHub 백업/복원 설정(기획 F3). 저장소·토큰을 등록하고, 전체 데이터를 JSON으로
 * GitHub에 백업하거나 복원한다. 복원은 로컬을 전체 교체하므로 확인 모달을 거친다.
 */
export function BackupSection() {
  const [config, setConfig] = useState<BackupConfig>(DEFAULT_BACKUP_CONFIG);
  const [token, setToken] = useState("");
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<null | "backup" | "restore" | "save">(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setConfig(await getBackupConfig());
        setToken(await getToken());
        setLastAt(await getLastBackupAt());
      } catch (e) {
        console.error("[BackupSection] 설정 로드 실패", e);
      }
    })();
  }, []);

  const ready = isConfigReady(config, token);

  const saveConfig = async () => {
    setBusy("save");
    try {
      await saveBackupConfig(config);
      await saveToken(token.trim());
      toast.success("백업 설정을 저장했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const doBackup = async () => {
    setBusy("backup");
    try {
      // 최신 입력값을 먼저 저장하고 백업(저장 안 눌러도 동작하도록).
      await saveBackupConfig(config);
      await saveToken(token.trim());
      const at = await pushBackup(config, token.trim());
      setLastAt(at);
      toast.success("GitHub에 백업했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    setBusy("restore");
    try {
      const payload = await restoreBackup(config, token.trim());
      void emitSessionSaved(); // 대시보드/통계 새로고침
      toast.success(
        `복원 완료: 과목 ${payload.subjects.length} · 세션 ${payload.sessions.length}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setConfirmRestore(false);
    }
  };

  const field = (key: keyof BackupConfig, label: string, placeholder: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <Input
        value={config[key]}
        placeholder={placeholder}
        onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <Section
      icon={Github}
      title="GitHub 백업"
      description="전체 데이터(과목·세션·설정)를 GitHub 저장소에 JSON으로 백업/복원합니다."
    >
      <div className="grid grid-cols-2 gap-3">
        {field("owner", "GitHub 사용자/조직", "pyjhoop")}
        {field("repo", "저장소 이름", "study-log-backup")}
        {field("branch", "브랜치", "main")}
        {field("path", "파일 경로", "study-log-backup.json")}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">
          Personal Access Token (repo 쓰기 권한)
        </span>
        <Input
          type="password"
          value={token}
          placeholder="ghp_..."
          autoComplete="off"
          onChange={(e) => setToken(e.target.value)}
        />
      </label>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        ⚠️ 토큰은 이 PC의 로컬 DB에 <b className="text-foreground">평문으로</b> 저장됩니다. 백업 파일(JSON)에는 포함되지 않습니다.
        비공개(private) 저장소와 <b className="text-foreground">최소 권한</b> 토큰을 권장합니다.
      </p>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="outline" onClick={() => void saveConfig()} disabled={busy !== null}>
          설정 저장
        </Button>
        <Button onClick={() => void doBackup()} disabled={!ready || busy !== null}>
          <CloudUpload /> {busy === "backup" ? "백업 중…" : "지금 백업"}
        </Button>
        <Button
          variant="destructive"
          onClick={() => setConfirmRestore(true)}
          disabled={!ready || busy !== null}
        >
          GitHub에서 복원
        </Button>
        {lastAt != null && (
          <span className="ml-auto text-xs text-muted-foreground">
            마지막 백업: {formatWhen(lastAt)}
          </span>
        )}
      </div>

      <ConfirmDialog
        open={confirmRestore}
        title="GitHub에서 복원"
        message="현재 PC의 모든 과목·세션·설정을 백업 파일 내용으로 덮어씁니다. 되돌릴 수 없습니다. 계속할까요?"
        confirmLabel="복원"
        destructive
        onCancel={() => setConfirmRestore(false)}
        onConfirm={doRestore}
      />
    </Section>
  );
}
