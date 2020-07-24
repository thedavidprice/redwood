import { groupBy, mapValues } from 'lodash'
import * as tsm from 'ts-morph'
import { TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  CodeAction,
  CodeActionContext,
  Diagnostic,
  DiagnosticSeverity,
  DocumentUri,
  Location,
  Position,
  Range,
  WorkspaceChange,
  WorkspaceEdit,
} from 'vscode-languageserver-types'
import { URL_file } from './URL'

export function Range_contains(range: Range, pos: Position): boolean {
  if (Position_compare(range.start, pos) === 'greater') return false
  if (Position_compare(range.end, pos) === 'smaller') return false
  return true
}
/**
 * p1 is greater|smaller|equal than/to p2
 * @param p1
 * @param p2
 */
export function Position_compare(
  p1: Position,
  p2: Position
): 'greater' | 'smaller' | 'equal' {
  if (p1.line > p2.line) return 'greater'
  if (p2.line > p1.line) return 'smaller'
  if (p1.character > p2.character) return 'greater'
  if (p2.character > p1.character) return 'smaller'
  return 'equal'
}

export function Range_fromNode(node: tsm.Node): Range {
  const start = Position_fromTSMorphOffset(
    node.getStart(false),
    node.getSourceFile()
  )
  const end = Position_fromTSMorphOffset(node.getEnd(), node.getSourceFile())
  return { start, end }
}

export function Location_fromNode(node: tsm.Node): Location {
  return {
    uri: URL_file(node.getSourceFile().getFilePath()),
    range: Range_fromNode(node),
  }
}

export function Location_fromFilePath(filePath: string): Location {
  return { uri: URL_file(filePath), range: Range.create(0, 0, 0, 0) }
}

/**
 * returns vscode-terminal-friendly (clickable) link with line/column information
 * ex: "file:///foo.ts:2:3"
 * @param loc
 */
export function LocationLike_toTerminalLink(loc: LocationLike): string {
  const {
    uri,
    range: {
      start: { line, character },
    },
  } = LocationLike_toLocation(loc)
  return `${uri}:${line + 1}:${character + 1}`
}

/**
 * returns vscode-terminal-friendly (clickable) link with line/column information
 * ex: "file:///foo.ts:2:3"
 * @param loc
 */
export function LocationLike_toHashLink(loc: LocationLike): string {
  const {
    uri,
    range: {
      start: { line, character },
    },
  } = LocationLike_toLocation(loc)
  return `${uri}#${line + 1}:${character + 1}`
}

export type LocationLike = tsm.Node | string | Location | ExtendedDiagnostic

export function LocationLike_toLocation(x: LocationLike): Location {
  if (typeof x === 'string') {
    return { uri: URL_file(x), range: Range.create(0, 0, 0, 0) }
  }
  if (typeof x === 'object') {
    if (x instanceof tsm.Node) return Location_fromNode(x)
    if (Location.is(x)) return x
    if (ExtendedDiagnostic_is(x))
      return { uri: x.uri, range: x.diagnostic.range }
  }
  throw new Error()
}

export function ExtendedDiagnostic_is(x: any): x is ExtendedDiagnostic {
  if (typeof x !== 'object') return false
  if (typeof x === 'undefined') return false
  if (typeof x.uri !== 'string') return false
  if (!Diagnostic.is(x.diagnostic)) return false
  return true
}

export function ExtendedDiagnostic_groupByUri(
  ds: ExtendedDiagnostic[]
): { [uri: string]: Diagnostic[] } {
  const grouped = groupBy(ds, (d) => d.uri)
  return mapValues(grouped, (xds) => xds.map((xd) => xd.diagnostic))
}

export async function ExtendedDiagnostic_findRelevantQuickFixes(
  xd: ExtendedDiagnostic,
  context: CodeActionContext
): Promise<CodeAction[]> {
  // check context to see if any of the context.diagnostics are equivalent
  for (const ctx_d of context.diagnostics) {
    const node_d = xd.diagnostic
    if (Diagnostic_compare(ctx_d, node_d)) {
      if (xd.quickFix) {
        const a = await xd.quickFix()
        if (a) {
          a.kind = 'quickfix'
          a.diagnostics = [ctx_d]
          return [a]
        }
      }
    }
  }
  return []
}

export function Position_fromTSMorphOffset(
  offset: number,
  sf: tsm.SourceFile
): Position {
  const { line, column } = sf.getLineAndColumnAtPos(offset)
  return { character: column - 1, line: line - 1 }
}

/**
 * The Diagnostic interface defined in vscode-languageserver-types
 * does not include the document URI.
 * This interface adds that, and a few other things.
 */
export interface ExtendedDiagnostic {
  uri: DocumentUri
  diagnostic: Diagnostic
  /**
   * A function that returns a quickfix associated to this diagnostic.
   */
  quickFix?: () => Promise<CodeAction | undefined>
}

/**
 * Helper method to create diagnostics
 * @param node
 * @param message
 */
export function err(
  loc: LocationLike,
  message: string,
  code?: number | string
): ExtendedDiagnostic {
  const { uri, range } = LocationLike_toLocation(loc)
  return {
    uri,
    diagnostic: {
      range,
      message,
      severity: DiagnosticSeverity.Error,
      code,
    },
  }
}

export function Diagnostic_compare(d1: Diagnostic, d2: Diagnostic): boolean {
  if (d1.code !== d2.code) return false
  if (d1.message !== d2.message) return false
  if (!Range_equals(d1.range, d2.range)) return false
  return true
}

export function Range_equals(r1: Range, r2: Range): boolean {
  return toArr(r1).join(',') === toArr(r2).join(',')
  function toArr(r: Range) {
    return [r.start.line, r.start.character, r.end.line, r.end.character]
  }
}

function DiagnosticSeverity_getLabel(severity?: DiagnosticSeverity): string {
  const { Information, Error, Hint, Warning } = DiagnosticSeverity
  const labels = {
    [Information]: 'info',
    [Error]: 'error',
    [Hint]: 'hint',
    [Warning]: 'warning',
  }
  return labels[severity ?? Information]
}

export type GetSeverityLabelFunction = typeof DiagnosticSeverity_getLabel

interface ExtendedDiagnosticFormatOpts {
  cwd?: string
  getSeverityLabel?: GetSeverityLabelFunction
}

/**
 * Returns a string representation of a diagnostic.
 * TSC style single-line errors:
 * ex: "b.ts:1:2: error: this is a message"
 * ex: "/path/to/app/b.ts:1:2: info: this is a message"
 */
export function ExtendedDiagnostic_format(
  d: ExtendedDiagnostic,
  opts?: ExtendedDiagnosticFormatOpts
) {
  const {
    diagnostic: { severity, message, code },
  } = d
  const cwd = opts?.cwd
  const getSeverityLabel = opts?.getSeverityLabel ?? DiagnosticSeverity_getLabel

  let base = 'file://'
  if (cwd) base = URL_file(cwd)
  if (!base.endsWith('/')) base += '/'
  const file = LocationLike_toTerminalLink(d).substr(base.length)

  const severityLabel = getSeverityLabel(severity)

  const errorCode = code ? ` (${code})` : ''

  const str = `${file}: ${severityLabel}${errorCode}: ${message}`
  return str
}

/**
 * a value of "null" means this file needs to be deleted
 */
export type FileSet = { [fileURI: string]: string | null }

export function FileSet_fromTextDocuments(
  documents: TextDocuments<TextDocument>
) {
  const files: FileSet = {}
  for (const uri of documents.keys()) files[uri] = documents.get(uri)!.getText()
  return files
}

export function WorkspaceEdit_fromFileSet(
  files: FileSet,
  getExistingFileText?: (fileURI: string) => string | undefined
): WorkspaceEdit {
  const change = new WorkspaceChange({ documentChanges: [] })
  for (const uri of Object.keys(files)) {
    const content = files[uri]
    if (typeof content !== 'string') {
      change.deleteFile(uri, { ignoreIfNotExists: true })
      continue
    } else {
      const text = getExistingFileText?.(uri)
      if (text) {
        // file exists
        //change.createFile(uri, { overwrite: true })
        change
          .getTextEditChange({ uri, version: null })
          .replace(Range_full(text), content)
      } else {
        change.createFile(uri)
        change
          .getTextEditChange({ uri, version: null })
          .insert(Position.create(0, 0), content)
      }
    }
  }
  return change.edit
}

export function Range_full(text: string, cr = '\n'): Range {
  if (text === '') return Range.create(0, 0, 0, 0)
  const lines = text.split(cr)
  if (lines.length === 0) return Range.create(0, 0, 0, 0)
  const start = Position.create(0, 0)
  const end = Position.create(lines.length - 1, lines[lines.length - 1].length)
  return Range.create(start, end)
}
