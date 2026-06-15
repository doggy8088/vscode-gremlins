# 程式碼除妖鏡 (Gremlins Tracker) for Visual Studio Code

[![GitHub package version](https://img.shields.io/github/package-json/v/doggy8088/vscode-gremlins.svg?style=for-the-badge&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=doggy8088.code-gremlins-detector)
[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/d/doggy8088.code-gremlins-detector.svg?style=for-the-badge&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=doggy8088.code-gremlins-detector)
[![GitHub stars](https://img.shields.io/github/stars/doggy8088/vscode-gremlins.svg?style=for-the-badge&logo=github)](https://github.com/doggy8088/vscode-gremlins/stargazers)

這款 [Visual Studio Code](https://code.visualstudio.com/) 擴充功能可以幫你找出程式碼中潛在的「妖魔鬼怪」（Gremlins，即隱形字元、零寬字元，或看起來和正常字元一模一樣的干擾字元），避免它們造成編譯或執行時難以排查的錯誤。

## 特色與功能

- 當程式碼中存在**零寬空格 (zero-width space)** 時，套件會以紅色邊框標記
- 當程式碼中存在**零寬不連字字元 (zero-width non-joiner)** 時，套件會以紅色邊框標記
- 對於其他可能有害的干擾字元，套件會以淡紅色或橘色背景標記
  - 不換行空格 (Non-breaking spaces)
  - 左/右雙引號 (Left and right double quotation marks)
  - 以及更多其他干擾字元
- 對於一些雖然無害但您可能想知道其存在的字元，套件會以藍色背景標記
- 當你將游標移到被標記的字元上時，會顯示懸浮提示，告訴你這個字元的 Unicode 編碼和說明
- 側邊欄 (Gutter) 會在包含這些干擾字元的每一行顯示一個「除妖鏡小精靈」圖示

![程式碼除妖鏡執行畫面](images/screenshot.png)

您也可以搭配使用 [“Unicode code point of current character” 擴充功能](https://marketplace.visualstudio.com/items?itemName=zeithaste.cursorCharCode) 來在狀態列顯示目前游標下字元的 Unicode 詳細資訊。

## 新增自訂干擾字元

您可以透過使用者設定中的 `gremlins.characters` 鍵值，設定其他要追蹤的自訂字元以及它們的顯示方式。

例如，以下程式碼片段新增了 "U+000C" 換頁字元 (FORM FEED)：

```jsonc
"gremlins.characters": {
  "000c" : {
    "zeroWidth": true,
    "description": "換頁字元 (FORM FEED, FF)",
    "overviewRulerColor": "rgba(255,127,80,1)",
  }
}
```

歡迎透過發起 Pull Request 或建立 Issue 來提供建議，協助我們改進預設追蹤的字元。

您可以在 [Unicode Table](https://unicode-table.com/en/) 查詢所有字元的 Unicode。

## 特定程式語言的干擾字元設定

您可以透過設定特定語言的屬性，為該語言覆蓋或停用字元設定（例如，針對 Markdown 檔案使用 `[markdown]` 區段）。

> 關於特定語言編輯器設定的更多資訊，請參閱 VSCode 官方文件：[Language specific editor settings](https://code.visualstudio.com/docs/getstarted/settings#_language-specific-editor-settings)。

例如，以下程式碼片段為 markdown 檔案新增了 "U+000C" (換頁字元)，同時忽略了 "U+00A0" (不換行空格) 字元：

```jsonc
"[markdown]": {
  "gremlins.characters": {
    // 為 markdown 檔案啟用換頁字元偵測
    "000c" : {
      "zeroWidth": true,
      "description": "換頁字元 (FORM FEED, FF)",
      "level": "error",
    },
    // 在 markdown 檔案中忽略不換行空格
    "00a0": {
      "level": "none"
    }
  }
}
```

## 指定無效字元的範圍

您可以指定一個十六進位區間，用單一規則來標記多個連續字元。

例如，在 macOS 中，如果將 Option 鍵設為修飾鍵，很容易在不經意間打出 [Latin-1 補充字元 (Latin-1 Supplemental Characters)](https://unicode-table.com/en/blocks/latin-1-supplement/)，這在一般的編輯器中很難被察覺。

為了捕捉這個範圍，上述連結中顯示的 Unicode 範圍為：`0080—00FF`

您可以設定如下規則：

```jsonc
"gremlins.characters": {
    "0080-00FF": {
        "level": "error",
        "zeroWidth": false,
        "description": "偵測到 Latin-1 補充字元",
        "overviewRulerColor": "rgba(255,127,80,1)",
    },
}
```

您可以嘗試複製一些 [補充字元](https://unicode-table.com/en/blocks/latin-1-supplement/) 來測試效果，或使用底下的範例：
如果您將 VS Code 的問題面板 (Problems Pane) 設定為標記錯誤，這些字元會立即被標記為錯誤。

```text
»
×
Ö
```

## 隱藏特定字元的側邊欄圖示

您可以選擇隱藏特定字元在側邊欄 (Gutter) 中的除妖鏡小精靈圖示。

同樣是在 `gremlins.characters` 中，為字元加入 `hideGutterIcon` 屬性並設為 `true` 即可。

例如，這會隱藏不換行空格 (Non-breaking space) 的側邊欄小精靈圖示：

```jsonc
"gremlins.characters": {
  "00a0" : {
    "hideGutterIcon": true
  }
}
```

## 在問題面板 (Problems) 中顯示干擾字元

預設情況下，干擾字元會在編輯器中高亮顯示，且在側邊欄 (Gutter) 顯示小精靈圖示。您可以使用使用者設定中的 `gremlins.showInProblemPane` 鍵值，決定是否也要在「問題 (Problems)」面板中顯示偵測到的干擾字元。

![在問題面板中顯示](images/problems-screenshot.png)

## 顯示行尾字元 (EOL)

如果您希望顯示行尾字元，建議使用 [Render Line Endings 套件](https://marketplace.visualstudio.com/items?itemName=medo64.render-crlf)。

# 站在巨人的肩膀上

本套件 (VS Code Gremlins) 最初深受 [Sublime Gremlins](https://packagecontrol.io/packages/Gremlins) 的啟發。後者是一個 [Sublime Text 3](https://www.sublimetext.com/) 外掛，用來標記隱形和模稜兩可的 Unicode 空白字元（如零寬空格、不換行空格等）。

後來我們發現，「Gremlins」這個名稱早在 1992 年就出現在其他編輯器中了：

[Bare Bones Software](http://www.barebones.com/) 著名且深受 macOS 使用者喜愛的 [BBEdit](http://www.barebones.com/products/bbedit/) HTML 與文字編輯器，自從 **1992 年 4 月 12 日**推出的第一個公開版本中，就內建了「Zap Gremlins（除妖功能）」！

以下是 BBEdit 最近版本的畫面：

<p style="text-align: center"><img src="https://raw.githubusercontent.com/doggy8088/vscode-gremlins/master/images/bbedit-gremlins.png" width="50%" height="auto" alt="在 BBEdit 中搜尋 Gremlins" /></p>

許多使用者非常喜愛這個功能，甚至曾經為它架設了[一個專屬網站](http://zapgremlins.com/)。雖然該網站目前已關閉，但感謝 Archive.org 還保留著[快照版本](https://web.archive.org/web/20120618091150/http://zapgremlins.com/)：

<p style="text-align: center"><img src="https://raw.githubusercontent.com/doggy8088/vscode-gremlins/master/images/zap-gremlins.jpg" width="75%" height="auto" alt="Zap Gremlins 網站快照" /></p>

## 授權條款

MIT
