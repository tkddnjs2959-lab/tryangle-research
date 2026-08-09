'use client';

/**
 * 되돌리기 어려운 동작에 확인창을 붙인 제출 버튼.
 *
 * 어드민 화면은 대부분 서버 컴포넌트라 onClick 을 직접 달 수 없다.
 * 삭제·보관처럼 한 번 누르면 끝나는 버튼만 이걸로 감싼다.
 */
export default function ConfirmButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
