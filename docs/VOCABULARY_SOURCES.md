# 词表来源与生成方式

## 为什么不称为“CEFR 官方词表”

CEFR 由欧洲委员会提供能力等级和 can-do 描述，并不发布一份覆盖所有语言、可直接复制使用的官方英语词表。Cambridge English Vocabulary Profile、Oxford 3000 等资源具有很高的参考价值，但其在线可查阅不等于允许把完整数据重新打包进扩展。

因此，渐读只内置明确允许再使用的数据，并把界面中的 A1–C2 称为“CEFR 参考难度”。

## 当前组成

- 340 条项目人工维护词条，用于网页、技术和常见阅读场景。
- 2,000 条 A1–B2 候选词，等级来自 CEFR-J Vocabulary Profile v1.5。
- 1,000 条 C1–C2 候选词，等级来自 Octanove Vocabulary Profile v1.0。
- 英中映射来自 ECDICT，并经过词性、歧义数量、长度、重复项和高歧义词过滤。
- 合并并由人工维护词条覆盖冲突后，共 3,189 条唯一中文词条。

这些等级是学习参考，不表示某个词在所有语义和上下文中都固定属于同一 CEFR 等级。中英词汇也不是一一对应关系；在需要上下文消歧时，AI 增强模式会比纯本地词表更合适。

## 重新生成

准备以下上游 CSV：

- `cefrj-vocabulary-profile-1.5.csv`
- `octanove-vocabulary-profile-c1c2-1.0.csv`
- `ecdict.csv`

然后运行：

```bash
node scripts/generate-cefr-lexicon.mjs \
  --cefrj /path/to/cefrj-vocabulary-profile-1.5.csv \
  --advanced /path/to/octanove-vocabulary-profile-c1c2-1.0.csv \
  --ecdict /path/to/ecdict.csv \
  --output src/shared/lexicon-cefrj.ts
```

脚本为 A1–C2 每档选择 500 条候选词。不要直接手工编辑生成文件；需要修正常见网页语义时，应优先在 `src/shared/lexicon.ts` 的人工维护区添加覆盖项。

完整署名和许可见仓库根目录的 `THIRD_PARTY_NOTICES.md`。
