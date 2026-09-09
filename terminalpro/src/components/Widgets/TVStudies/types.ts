import type {
  CustomIndicator,
  IContext,
  IPineStudyResult,
  LibraryPineStudy,
  StudyInputValue,
  StudyMetaInfo,
} from "~/lib/charting_library/charting_library";

export interface PineStudy<T extends IPineStudyResult> extends LibraryPineStudy<T> {
  init: (this: PineStudy<T>, ...args: Parameters<LibraryPineStudy<T>["init"]>) => void;

  main: (this: PineStudy<T>, ...args: Parameters<LibraryPineStudy<T>["main"]>) => T;

  _context?: IContext;
  _input?: <T extends StudyInputValue>(index: number) => T;
  _currentSymbol?: string;
}

export interface ExtendedCustomIndicator extends CustomIndicator {
  readonly name: string;
  readonly metainfo: StudyMetaInfo;
  readonly constructor: (this: PineStudy<IPineStudyResult>) => void;
}
