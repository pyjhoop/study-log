import { fetch } from "@tauri-apps/plugin-http";
import { getVersion } from "@tauri-apps/api/app";

/**
 * 개발자 문의(버그·개선 제안) 전송. 서버가 없는 로컬 앱이라, 폼백엔드 서비스
 * **Web3Forms**로 POST하면 개발자 이메일로 문의가 배달된다.
 *
 * - 전송은 `@tauri-apps/plugin-http`의 `fetch`(스코프는 capability의 api.web3forms.com).
 * - `access_key`는 **공개용**(클라이언트에 임베드하도록 설계된 키)이라 코드에 두어도 된다.
 *   발급: https://web3forms.com 에서 이메일만 입력 → 메일로 access key 수신(계정/로그인 불필요).
 * - 문의자는 **로그인 없이** 앱 안에서 바로 보낸다. 앱 버전·환경(userAgent)을 자동 첨부해
 *   버그 리포트 품질을 높인다.
 */

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

// web3forms.com에서 발급받은 access key(공개용 — 클라이언트 임베드 전제라 리포에 두어도 안전).
const WEB3FORMS_ACCESS_KEY = "9500b361-fb1a-44ff-88b9-0757efca223c";

export type InquiryKind = "bug" | "feature" | "etc";

export const INQUIRY_KINDS: { id: InquiryKind; label: string }[] = [
  { id: "bug", label: "버그 신고" },
  { id: "feature", label: "기능 제안·개선" },
  { id: "etc", label: "기타 문의" },
];

export interface InquiryInput {
  kind: InquiryKind;
  title: string;
  body: string;
  /** 답장받을 이메일(선택). 비우면 익명 문의. */
  email?: string;
}

/** access key가 실제 값(UUID 형식)으로 교체됐는지 — 화면에서 폼 활성/안내 분기용. */
export function isSupportConfigured(): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    WEB3FORMS_ACCESS_KEY,
  );
}

/** 현재 앱 버전(실패해도 문의는 보낼 수 있게 폴백). */
async function appVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "unknown";
  }
}

/**
 * 문의를 Web3Forms로 전송한다. 성공하면 개발자 이메일로 배달된다.
 * 실패(네트워크·서비스 오류)는 예외로 던져 화면에서 toast로 안내한다.
 */
export async function submitInquiry(input: InquiryInput): Promise<void> {
  if (!isSupportConfigured()) {
    throw new Error("문의 채널이 아직 설정되지 않았습니다.");
  }

  const kindLabel = INQUIRY_KINDS.find((k) => k.id === input.kind)?.label ?? input.kind;
  const version = await appVersion();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const email = input.email?.trim();

  // Web3Forms는 `email` 필드를 답장 주소(reply-to)로 자동 인식한다. 없으면 익명.
  const payload: Record<string, string> = {
    access_key: WEB3FORMS_ACCESS_KEY,
    from_name: "StudyLog 사용자",
    subject: `[StudyLog 문의] ${kindLabel} · ${input.title}`,
    유형: kindLabel,
    제목: input.title,
    내용: input.body,
    앱버전: version,
    환경: ua,
    ...(email ? { email, replyto: email } : {}),
  };

  let res: Response;
  try {
    res = await fetch(WEB3FORMS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("네트워크 오류로 전송하지 못했습니다. 인터넷 연결을 확인해 주세요.");
  }

  let data: { success?: boolean; message?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    // 본문 파싱 실패는 아래 상태코드로 판단.
  }

  if (!res.ok || !data.success) {
    throw new Error(data.message || `전송에 실패했습니다 (HTTP ${res.status}).`);
  }
}
