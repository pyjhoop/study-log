import { useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/settings/parts";
import {
  INQUIRY_KINDS,
  isSupportConfigured,
  submitInquiry,
  type InquiryKind,
} from "@/lib/support";

const TITLE_MAX = 80;
const BODY_MAX = 2000;

/**
 * 문의 화면. 로그인 없이 앱 안에서 버그 신고·개선 제안을 작성해 개발자에게 보낸다.
 * 전송은 `lib/support.ts`가 Web3Forms(폼백엔드)로 처리하고, 앱 버전·환경을 자동 첨부한다.
 */
export function SupportScreen() {
  const [kind, setKind] = useState<InquiryKind>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const configured = isSupportConfigured();
  const emailInvalid = email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend =
    configured &&
    !sending &&
    title.trim().length > 0 &&
    body.trim().length >= 5 &&
    !emailInvalid;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await submitInquiry({
        kind,
        title: title.trim(),
        body: body.trim(),
        email: email.trim() || undefined,
      });
      toast.success("문의를 보냈습니다. 소중한 의견 감사합니다!");
      setTitle("");
      setBody("");
      setEmail("");
      setKind("bug");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Section
        icon={LifeBuoy}
        title="개발자에게 문의"
        description="버그나 개선 아이디어를 보내주세요. 로그인 없이 앱 안에서 바로 전송됩니다."
      >
        {!configured && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ 문의 채널이 아직 설정되지 않았습니다. (개발자: <code>src/lib/support.ts</code>의
            access key를 교체하세요.)
          </p>
        )}

        {/* 유형 */}
        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">유형</span>
          <div className="flex flex-wrap gap-2">
            {INQUIRY_KINDS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  kind === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">제목</span>
          <Input
            value={title}
            maxLength={TITLE_MAX}
            placeholder="한 줄 요약 (예: 통계 화면이 가끔 안 뜸)"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {/* 내용 */}
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            내용
            <span className="ml-2 text-muted-foreground/70">
              {body.length}/{BODY_MAX}
            </span>
          </span>
          <textarea
            value={body}
            maxLength={BODY_MAX}
            rows={7}
            placeholder={
              "무슨 일이 있었나요? 버그라면 재현 순서, 기대한 동작과 실제 동작을 적어주시면 큰 도움이 됩니다."
            }
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </label>

        {/* 이메일(선택) */}
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            답장받을 이메일 <span className="text-muted-foreground/70">(선택)</span>
          </span>
          <Input
            type="email"
            value={email}
            placeholder="비우면 익명으로 전송됩니다"
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className={cn(emailInvalid && "border-destructive focus-visible:ring-destructive")}
          />
          {emailInvalid && (
            <span className="mt-1 block text-xs text-destructive">
              이메일 형식이 올바르지 않습니다.
            </span>
          )}
        </label>

        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          문제 파악을 돕기 위해 <b className="text-foreground">앱 버전</b>과{" "}
          <b className="text-foreground">실행 환경</b> 정보가 문의에 자동으로 첨부됩니다. 그 외 학습
          기록 등 개인 데이터는 전송되지 않습니다. 입력하신 이메일은{" "}
          <b className="text-foreground">답변 목적으로만</b> 사용되며 별도로 보관·공유하지 않습니다.
        </p>

        <div className="flex items-center justify-end border-t pt-3">
          <Button onClick={() => void send()} disabled={!canSend}>
            <Send /> {sending ? "보내는 중…" : "보내기"}
          </Button>
        </div>
      </Section>
    </div>
  );
}
