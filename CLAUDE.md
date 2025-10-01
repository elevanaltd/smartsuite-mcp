CONTEXT_PROTOCOL::[
  MANDATE::READ_ARCHITECTURE_FIRST[docs/001-ARCHITECTURE.md→constraints+failure_modes]
  BLOCKING::VIOLATION→TASK_FAILURE
  TRIGGER::[get_context,analyze,refactor,ANY_development_task]

  FORBIDDEN::[Search/Grep/Glob_direct,random_file_reads,immediate_coding,codebase_assumptions]

  REQUIRED_SEQUENCE::[
    1→docs/001-ARCHITECTURE.md[system_constraints]
    2→.claude/session.vars[repomix_outputId_check]
    3→mcp__repomix__pack_codebase[if_no_outputId]
    4→mcp__repomix__grep_repomix_output[ALL_searches]
    5→"Context prepared. Found:"[response_prefix]
  ]
]

CONTEXT_PHASES::[
  INIT::[
    READ→docs/001-ARCHITECTURE.md[constraints+failure_modes]
    CHECK→.claude/session.vars[outputId_exists]
    RUN→bash .claude/hooks/post-session-start.sh[if_needed]
    PACK→mcp__repomix__pack_codebase[
      directory:current_working_directory
      includePatterns:"src/**/*.ts,test/**/*.ts,*.json,*.md"
      save_to:.claude/session.vars+.claude/last-pack-id.txt
    ]
    EXTRACT→2_4_keywords[field_mapping,dry_run,SmartDoc_format]
  ]

  PATTERN_SEARCH::CRITICAL_SMARTSUITE[
    BEFORE_ANY_IMPLEMENTATION::[
      SEARCH→mcp__repomix__grep_repomix_output[outputId,"SmartDoc|checklist|linked_record"]
      CHECK→knowledge/[similar_operations]
      VERIFY→Architecture_doc["Common Failure Modes"]
      DISCOVER→MANDATORY[smartsuite_discover_tool_first]
    ]
  ]

  IMPACT_ANALYSIS::[
    DEPENDENCIES→import_graph_check
    TESTS→*.test.ts_coverage_search
    TRANSACTIONS→undo_operation_impact
    FORMATS→SmartDoc/checklist_compatibility
  ]

  REPORT_FORMAT::"Context prepared. Found:"[files,patterns,failures,ready_state]
]

SMARTSUITE_CRITICAL::[
  FIELD_FORMATS::MANDATORY[
    CHECKLIST→full_SmartDoc_rich_text_structure[knowledge_base_reference]
    SIMPLE_ARRAYS→FAIL[API_200_but_no_save]
    LINKED_RECORDS→arrays_always[even_single_values]
    DISCOVERY→discover_tool_first[cryptic_field_IDs]
  ]

  FAILURE_MODES::[
    SILENT_DATA_LOSS→incorrect_field_format[checklists_especially]
    FIELD_NOT_FOUND→display_names_vs_field_IDs
    FILTER_MISMATCH→"is"_vs_"has_any_of"[linked_records]
  ]

  TABLES::[
    PRIMARY→68a8ff5237fde0bf797c05b3[production]
    TEST→68ab34b30b1e05e11a8ba87f[safe_playground]
  ]
]

WORKFLOW::[
  PRE_BUILD_CHECKS::[
    DEPENDENCY_VALIDATION::[
      "npx tsc --version"→RECORD_TYPESCRIPT_VERSION,
      "npm ls @typescript-eslint/parser"→CHECK_PARSER_VERSION,
      VERIFY→"Parser supports TypeScript version",
      FIX_IF_NEEDED→"npm update @typescript-eslint/parser @typescript-eslint/eslint-plugin"
    ]
  ]

  PRE_CHANGE::[
    READ→docs/000-NORTH-STAR.md[vision_alignment]
    READ→docs/001-ARCHITECTURE.md[system_constraints]
    EXECUTE→context_protocol
    CHECK→existing_patterns_before_creation
  ]

  TESTING::MANDATORY[
    tests_for_new_features
    dry_run_true_first
    test_table_verification_before_production
    transaction_history_undo_compatibility
  ]

  DOCUMENTATION::[
    Architecture_doc→new_failure_modes
    knowledge_base→new_field_formats
    README→setup_requirement_updates
  ]
]

CI_VALIDATION_MANDATE::[
  BEFORE_CLAIMING_COMPLETE::[
    MANDATORY_SEQUENCE::[
      "npm run lint"→MUST_PASS[all_formatting_and_style_checks],
      "npm run typecheck"→MUST_PASS[all_TypeScript_files_including_tests],
      "npm run test"→MUST_PASS[all_test_suites]
    ]
    NEVER_JUST::"npm run build"→INSUFFICIENT[only_checks_src_not_tests]
  ]

  COMMON_AGENT_FAILURES::[
    BUILD_ONLY::FAILS[only_checks_src_not_tests]
    PARTIAL_TYPECHECK::FAILS[misses_test_file_errors]
    NO_LINT::FAILS[misses_formatting_issues]
    TEST_WITHOUT_TYPES::FAILS[runtime_passes_but_types_broken]
  ]

  VERIFICATION_EVIDENCE::[
    MUST_SHOW::"All three commands passing with actual output"
    NOT_ENOUGH::"Build successful" | "Tests pass" | "TypeScript clean"
    AUDIT_TRAIL::"Copy actual command outputs as evidence"
  ]

  FALSE_COMPLETION_PREVENTION::[
    IMPLEMENTATION_LEAD::MUST[run_all_three_before_reporting]
    ERROR_ARCHITECT::MUST[verify_all_three_in_fixes]
    CODE_REVIEW::MUST[confirm_CI_parity]
    ANY_AGENT::CANNOT[claim_complete_without_all_three]
  ]
]