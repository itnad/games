export const PAPEROID_BUILD_ID =
  import.meta.env.VITE_PAPEROID_BUILD_ID ?? "development";

/** 빌드한 커밋(앞 12자리, 작업 트리가 달랐으면 "+수정"). 게임 리포트의 재현에 쓴다. */
export const PAPEROID_GIT_SHA: string =
  import.meta.env.VITE_PAPEROID_GIT_SHA ?? "development";
