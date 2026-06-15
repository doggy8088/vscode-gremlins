const vscode = require('vscode')

const GREMLINS = 'gremlins'

const GREMLINS_LEVELS = {
  NONE: 'none',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
}

const GREMLINS_SEVERITIES = {
  [GREMLINS_LEVELS.INFO]: vscode.DiagnosticSeverity.Information,
  [GREMLINS_LEVELS.WARNING]: vscode.DiagnosticSeverity.Warning,
  [GREMLINS_LEVELS.ERROR]: vscode.DiagnosticSeverity.Error,
}

const gremlinsDefaultColor = 'rgba(169, 68, 66, .75)'

const eventListeners = []

let decorationTypes = {}

let processedDocuments = {}

const icons = {
  light: null,
  dark: null,
}

let diagnosticCollection = null

function configureDiagnosticsCollection(showDiagnostics) {
  if (showDiagnostics && !diagnosticCollection) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection(GREMLINS)
  } else if (!showDiagnostics && diagnosticCollection) {
    diagnosticCollection.clear()
    diagnosticCollection.dispose()
    diagnosticCollection = null
  }
  return diagnosticCollection
}

function disposeDecorationTypes() {
  Object.entries(decorationTypes).forEach(([, decorationType]) => {
    decorationType.dispose()
  })
  decorationTypes = {}
}

/**
 * 載入圖示路徑
 * @param {vscode.ExtensionContext} context
 */
function loadIcons(context) {
  icons.light = context.asAbsolutePath('images/gremlins-light.svg')
  icons.dark = context.asAbsolutePath('images/gremlins-dark.svg')
}

/**
 * 轉義 RegExp 特殊字元，確保使用者設定中的字元不破壞常規表示式
 * @param {string} string
 * @returns {string}
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 載入檔案對應的設定
 * @param {vscode.TextDocument} document
 */
function loadConfiguration(document) {
  const gremlinsConfiguration = vscode.workspace.getConfiguration(
    GREMLINS,
    document,
  )

  const gremlins = gremlinsFromConfig(gremlinsConfiguration)

  const showDiagnostics = gremlinsConfiguration.showInProblemPane
  const diagnosticCollection = configureDiagnosticsCollection(showDiagnostics)

  const regexpWithAllChars = new RegExp(
    Object.keys(gremlins)
      .map((char) => `${escapeRegExp(char)}+`)
      .join('|'),
    'g',
  )

  return {
    gremlins,
    regexpWithAllChars,
    diagnosticCollection,
  }
}

function gremlinsFromConfig(gremlinsConfiguration) {
  const gremlinsLevels = {
    [GREMLINS_LEVELS.INFO]: gremlinsConfiguration.color_info,
    [GREMLINS_LEVELS.WARNING]: gremlinsConfiguration.color_warning,
    [GREMLINS_LEVELS.ERROR]: gremlinsConfiguration.color_error,
  }
  const gremlinsCharacters = gremlinsConfiguration.characters
  const gutterIconSize = gremlinsConfiguration.gutterIconSize
  const hexCodePointsRangeRegex = /^([0-9a-f]+)(?:-([0-9a-f]+))?$/i

  const lightIcon = {
    gutterIconPath: icons.light,
    gutterIconSize: gutterIconSize,
  }
  const darkIcon = {
    gutterIconPath: icons.dark,
    gutterIconSize: gutterIconSize,
  }

  const gremlins = {}
  for (const [hexCodePoint, config] of Object.entries(gremlinsCharacters)) {
    const severityLevel = config.level
      ? config.level.toLowerCase()
      : GREMLINS_LEVELS.ERROR
    if (severityLevel === GREMLINS_LEVELS.NONE) {
      // 忽略設定為 none 的干擾字元
      continue
    }

    const decorationType = {
      light: config.hideGutterIcon ? {} : lightIcon,
      dark: config.hideGutterIcon ? {} : darkIcon,
      overviewRulerColor: config.overviewRulerColor || gremlinsDefaultColor,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    }

    if (config.zeroWidth) {
      decorationType.borderWidth = '1px'
      decorationType.borderStyle = 'solid'
      decorationType.borderColor = gremlinsLevels[severityLevel]
    } else {
      decorationType.backgroundColor = gremlinsLevels[severityLevel]
    }

    const hexCodePointsRange = hexCodePoint.match(hexCodePointsRangeRegex)
    if (hexCodePointsRange[2] !== undefined) {
      // 範圍字元 (例如 0080-00FF)
      const firstChar = parseInt(`0x${hexCodePointsRange[1]}`, 16)
      const lastChar = parseInt(`0x${hexCodePointsRange[2]}`, 16)

      for (let index = firstChar; index <= lastChar; ++index) {
        const thisHexCodePoint = index.toString(16)

        gremlins[String.fromCharCode(index)] = Object.assign({}, config, {
          thisHexCodePoint,
          decorationType: cachedDecorationType(decorationType),
        })
      }
    } else {
      // 單一字元
      gremlins[charFromHex(hexCodePoint)] = Object.assign({}, config, {
        hexCodePoint,
        decorationType: cachedDecorationType(decorationType),
      })
    }
  }

  return gremlins
}

function cachedDecorationType(decorationType) {
  const cacheKey = JSON.stringify(decorationType)
  if (!decorationTypes[cacheKey]) {
    decorationTypes[cacheKey] =
      vscode.window.createTextEditorDecorationType(decorationType)
  }
  return decorationTypes[cacheKey]
}

function charFromHex(hexCodePoint) {
  return String.fromCodePoint(`0x${hexCodePoint}`)
}

/**
 * 檢查目前文字編輯器中的干擾字元
 * @param {vscode.TextEditor} activeTextEditor
 */
function checkForGremlins(activeTextEditor) {
  if (!activeTextEditor) {
    return
  }

  const doc = activeTextEditor.document

  const { gremlins, regexpWithAllChars, diagnosticCollection } =
    loadConfiguration(doc)

  const decorationOption = {}
  for (const char in gremlins) {
    decorationOption[char] = []
  }
  /** @type {vscode.Diagnostic[]} */
  const diagnostics = []

  for (let lineNum = 0; lineNum < doc.lineCount; lineNum++) {
    const lineText = doc.lineAt(lineNum)
    const line = lineText.text

    let match
    while ((match = regexpWithAllChars.exec(line))) {
      const matchedCharacter = match[0][0]

      const gremlin = gremlins[matchedCharacter]
      const startPos = new vscode.Position(lineNum, match.index)
      const endPos = new vscode.Position(lineNum, match.index + match[0].length)
      const count = match[0].length

      const decoration = {
        range: new vscode.Range(startPos, endPos),
        hoverMessage: `此處有 ${count} 個 ${gremlin.description} (Unicode U+${gremlin.hexCodePoint})`,
      }

      decorationOption[matchedCharacter].push(decoration)

      if (diagnosticCollection) {
        const severity = GREMLINS_SEVERITIES[gremlin.level]
        const diagnostic = {
          range: decoration.range,
          message: decoration.hoverMessage,
          severity: severity,
          source: '程式碼除妖鏡',
        }
        diagnostics.push(diagnostic)
      }
    }
  }

  const decorations = groupDecorationsByType(gremlins, decorationOption)

  drawDecorations(activeTextEditor, decorations)

  if (diagnosticCollection) {
    diagnosticCollection.set(activeTextEditor.document.uri, diagnostics)
  }

  processedDocuments[activeTextEditor.document.uri] = { decorations }
}

function groupDecorationsByType(gremlins, decorationOption) {
  return Object.entries(gremlins).reduce((obj, [char, gremlin]) => {
    const { decorationType } = gremlin
    const options = decorationOption[char]

    if (!Object.prototype.hasOwnProperty.call(obj, decorationType.key)) {
      obj[decorationType.key] = {
        decorationType,
        options,
      }
    } else {
      obj[decorationType.key].options =
        obj[decorationType.key].options.concat(options)
    }
    return obj
  }, {})
}

function drawDecorations(activeTextEditor, decorations) {
  for (const { decorationType, options } of Object.values(decorations)) {
    activeTextEditor.setDecorations(decorationType, options)
  }
}

/**
 * 啟用套件
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  loadIcons(context)

  eventListeners.push(
    vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if (event.affectsConfiguration(GREMLINS)) {
          disposeDecorationTypes()
          processedDocuments = {}

          vscode.window.visibleTextEditors.forEach((editor) =>
            checkForGremlins(editor),
          )
        }
      },
      null,
      context.subscriptions,
    ),
  )

  eventListeners.push(
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor) {
          const processedDocument = processedDocuments[editor.document.uri]
          if (!processedDocument) {
            checkForGremlins(editor)
          } else {
            drawDecorations(editor, processedDocument.decorations)
          }
        }
      },
      null,
      context.subscriptions,
    ),
  )

  eventListeners.push(
    vscode.workspace.onDidChangeTextDocument(
      () => checkForGremlins(vscode.window.activeTextEditor),
      null,
      context.subscriptions,
    ),
  )

  eventListeners.push(
    vscode.workspace.onDidCloseTextDocument(
      (textDocument) => {
        if (diagnosticCollection) {
          diagnosticCollection.delete(textDocument.uri)
        }
        delete processedDocuments[textDocument.uri]
      },
      null,
      context.subscriptions,
    ),
  )

  checkForGremlins(vscode.window.activeTextEditor)
}
exports.activate = activate

// 停用套件
function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.clear()
    diagnosticCollection.dispose()
  }

  disposeDecorationTypes()

  eventListeners.forEach((listener) => listener.dispose())
  eventListeners.length = 0
}
exports.deactivate = deactivate
