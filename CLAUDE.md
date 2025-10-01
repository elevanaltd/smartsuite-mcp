PHOENIX_REBUILD_CONTEXT::[
  BLUEPRINT::"/Volumes/HestAI-Projects/smartsuite-api-shim/coordination/phoenix-rebuild/001-D3-PHOENIX-REBUILD-BLUEPRINT.md"
  ARCHITECTURE::Sentinel_Architecture[2_tools_intelligent_facade+undo]
  PHASES::[
    Phase_0::Foundation_Setup[COMPLETE→quality_gates+TypeScript_strict+Vitest+CI],
    Phase_1::Test_Contracts[COMPLETE→18_contracts_P0_P1_P2],
    Phase_2A::QueryHandler[COMPLETE→7_7_tests_GREEN],
    Phase_2B::SmartSuiteClient[COMPLETE→27_27_tests_GREEN→commit_0a0166e],
    Phase_2C::FieldTranslator[COMPLETE→35_35_tests_GREEN→commit_280c23f],
    Phase_2D::Operation_Handlers[IN_PROGRESS→RecordHandler+SchemaHandler+DiscoverHandler],
    Phase_3::MCP_Integration[BLOCKED→awaiting_Phase_2D_completion]
  ]
  CURRENT_PHASE::Phase_2D[RecordHandler+SchemaHandler+DiscoverHandler]
  DESIGN_PRINCIPLES::[
    behavioral_tests_as_truth_source,
    minimal_MCP_surface[2_tools_only],
    quality_gates_first_implementation_second,
    Phoenix_pattern[extract_contracts→discard_broken→rebuild_clean]
  ]
]

HARVEST_RESOURCES::[
  ARCHIVE_LOCATION::"staging/archive/old-staging/src/tools/"
  AVAILABLE_IMPLEMENTATIONS::[
    record.ts[19KB]→RecordHandler_reference_patterns,
    schema.ts[7.4KB]→SchemaHandler_reference_implementation,
    discover.ts[2.6KB]→DiscoverHandler_reference_logic,
    "*.test.ts"→test_case_extraction_and_edge_case_validation
  ]
  HARVEST_DISCIPLINE::[
    READ_for_patterns_and_logic[understand_before_adapt],
    EXTRACT_test_cases_and_validation[proven_edge_cases],
    ADAPT_to_new_architecture[Phoenix_pattern_compliance],
    DO_NOT_copy_paste_without_understanding[anti_contamination],
    VERIFY_against_behavioral_contracts[Phase_1_test_contracts]
  ]
  USAGE_PROTOCOL::[
    BEFORE_new_handler_implementation→READ_archived_version,
    EXTRACT_test_scenarios→ADAPT_to_Phoenix_contracts,
    VALIDATE_patterns→APPLY_to_clean_implementation
  ]
]

SMARTSUITE_DOMAIN_TRUTH::[
  LOCATION::"/Volumes/HestAI-Projects/smartsuite-api-shim/coordination/smartsuite-truth/"
  CRITICAL_DOCUMENTS::[
    CRITICAL-FORMATS-TRUTH.md→SmartDoc_checklist_format_requirements[SILENT_FAILURE_PREVENTION],
    API-CAPABILITIES-TRUTH.md→supported_operations_and_endpoints,
    API-LIMITATIONS-TRUTH.md→known_constraints_and_gotchas,
    FIELD-OPERATIONS-TRUTH.md→field_translation_patterns_and_mappings,
    QUICK-REFERENCE.md→common_operations_cheatsheet
  ]
  CONSULTATION_MANDATE::[
    BEFORE_field_format_implementation[especially_checklists_and_rich_text],
    BEFORE_API_endpoint_usage[verify_supported_operations],
    WHEN_encountering_SmartSuite_errors[check_known_limitations],
    DURING_field_translation_work[reference_proven_patterns]
  ]
  FORMAT_CRITICALITY::[
    CHECKLIST_FIELDS→full_SmartDoc_structure_required[simple_arrays_FAIL_silently],
    LINKED_RECORDS→arrays_always[even_single_values],
    DATE_RANGES→from_date_to_date_structure_required,
    STATUS_FIELDS→option_codes_not_display_labels
  ]
]

IMPLEMENTATION_STATUS::[
  COMPLETE::[
    Phase_0::Quality_gates[TypeScript_strict+ESLint+Vitest+CI_workflow],
    Phase_1::Test_contracts[18_behavioral_contracts_P0_P1_P2],
    Phase_2A::QueryHandler[7_7_tests_GREEN],
    Phase_2B::SmartSuiteClient[27_27_tests_GREEN→git_0a0166e],
    Phase_2C::FieldTranslator[35_35_tests_GREEN→git_280c23f→PR_merged_phase-2c]
  ]
  IN_PROGRESS::[
    Phase_2D::Operation_Handlers[RecordHandler+SchemaHandler+DiscoverHandler→harvest_from_archive]
  ]
  BLOCKED::[
    Phase_3::MCP_Integration[awaiting_Phase_2D_operation_handlers_completion]
  ]
  BRANCH_STATUS::[
    main→Phase_2C_merged[commit_625f813],
    phase-2d→active_development[commits_234c64d_bf4f30c]
  ]
]

CONTEXT_PROTOCOL::[
  MANDATE::READ_ARCHITECTURE_FIRST[Blueprint+Domain_Truth→constraints+failure_modes]
  BLOCKING::VIOLATION→TASK_FAILURE
  TRIGGER::[get_context,analyze,refactor,ANY_development_task]

  FORBIDDEN::[Search/Grep/Glob_direct,random_file_reads,immediate_coding,codebase_assumptions]

  REQUIRED_SEQUENCE::[
    1→coordination/phoenix-rebuild/001-D3-PHOENIX-REBUILD-BLUEPRINT.md[architectural_plan+phase_context],
    2→coordination/smartsuite-truth/CRITICAL-FORMATS-TRUTH.md[domain_constraints+format_requirements],
    3→.claude/session.vars[repomix_outputId_check],
    4→mcp__repomix__pack_codebase[if_no_outputId],
    5→mcp__repomix__grep_repomix_output[ALL_searches],
    6→"Context prepared. Found:"[response_prefix]
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