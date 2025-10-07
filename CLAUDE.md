PHOENIX_REBUILD_CONTEXT::[
  BLUEPRINT::"/Volumes/HestAI-Projects/smartsuite-api-shim/coordination/phoenix-rebuild/001-D3-PHOENIX-REBUILD-BLUEPRINT.md"
  ARCHITECTURE::Direct_Tool_Architecture[6_explicit_tools]

  ARCHITECTURAL_DECISION::[
    DATE::2025-10-03
    DECISION::Enhanced_Direct_Tools[6_tools+knowledge_wrapper]
    RATIONALE::[
      Empirical_Evidence::Facade_added_70%_code_without_user_benefit,
      Agent_Consensus::requirements-steward+critical-engineer+technical-architect,
      Constitutional_Compliance::MINIMAL_INTERVENTION_PRINCIPLE[essential_only],
      North_Star_Amendment::APPROVED[simplest_implementation>fewest_registry_entries]
    ]
    REFERENCE_COMMIT::818f7b2[knowledge-base-path-resolution-implementation]
  ]

  TOOL_ARCHITECTURE::[
    smartsuite_query[list+get+search+count_operations],
    smartsuite_record[create+update+delete_operations],
    smartsuite_schema[table_structure_retrieval],
    smartsuite_discover[field_mapping_discovery],
    smartsuite_intelligent[AI_guided_operations+safety_analysis],
    smartsuite_field_create[field_creation],
    smartsuite_field_update[field_modification]
  ]
  NOTE::"undo removed - SmartSuite API has no undo/rollback capability. Dry-run mode is the safety mechanism."

  KNOWLEDGE_BASE_ARCHITECTURE::[
    LOCATION::"config/knowledge/"
    STRUCTURE::[
      manifest.json[version_2.0.0+pattern_index],
      patterns/red/[6_BLOCKING_patterns],
      patterns/yellow/[6_WARNING_patterns],
      patterns/green/[5_SAFE_patterns],
      rules/[format+endpoint+operator_validation]
    ]
    PATTERN_CATEGORIES::[
      RED::BLOCKING[UUID_corruption,linked_record_format,SmartDoc_format,filter_operators,status_values,incomplete_choices],
      YELLOW::WARNING[bulk_limits,token_explosion,rate_limiting,field_positioning,trailing_slash,wrong_methods],
      GREEN::SAFE[field_creation,field_updates,record_CRUD,filtering,bulk_operations]
    ]
    VALIDATION_RULES::[
      format_validation[12_field_types],
      endpoint_validation[15+_endpoints],
      operator_validation[16_field_types]
    ]
    LOADING::[
      TRIGGER::MCP_server_startup,
      PERFORMANCE::<100ms_load_time,
      UPDATE_MECHANISM::restart_to_reload[edit_JSON→restart_server],
      AUTO_LOADING::self_updating[no_code_changes_needed]
    ]
    USAGE::[
      smartsuite_intelligent_tool→pattern_matching,
      safety_analysis→RED/YELLOW/GREEN_classification,
      suggested_corrections→guided_by_patterns
    ]
  ]

  PHASES::[
    Phase_0::Foundation_Setup[COMPLETE→quality_gates+TypeScript_strict+Vitest+CI],
    Phase_1::Test_Contracts[COMPLETE→18_contracts_P0_P1_P2],
    Phase_2A::QueryHandler[COMPLETE→7_7_tests_GREEN],
    Phase_2B::SmartSuiteClient[COMPLETE→27_27_tests_GREEN→commit_0a0166e],
    Phase_2C::FieldTranslator[COMPLETE→35_35_tests_GREEN→commit_280c23f],
    Phase_2D::Operation_Handlers[COMPLETE→44_handler_tests_GREEN→commit_ca7d485],
    Phase_2E::MCP_Tool_Layer[COMPLETE→46_tool_tests_GREEN→commit_f75ba76],
    Phase_2F::MCP_Server_Integration[COMPLETE→344_352_tests_GREEN→commit_c606295→PRODUCTION_READY],
    Phase_2G_REVISED::Enhanced_Direct_Tools[COMPLETE→6_tools_exposed+knowledge_wrapper],
    Phase_2J::Field_Management[COMPLETE→407_407_tests_GREEN→commit_ac7bfd2],
    Phase_2K::Knowledge_Base_Migration[COMPLETE→17_patterns+3_rule_sets→JSON_based],
    Phase_2L::Field_Operations_Fix[COMPLETE→double_nesting_resolved→commit_d5ec539→PRODUCTION_VALIDATED],
    Phase_4::User_Validation[COMPLETE→all_7_tools_operational]
  ]
  CURRENT_PHASE::Phase_4[PRODUCTION_READY→all_operations_validated]

  DESIGN_PRINCIPLES::[
    behavioral_tests_as_truth_source,
    simplest_implementation[direct_tools>routing_layers],
    solo_developer_ergonomics[clear_boundaries>polymorphic_facades],
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
    Phase_2C::FieldTranslator[35_35_tests_GREEN→git_280c23f],
    Phase_2D::Operation_Handlers[44_handler_tests_GREEN→git_ca7d485],
    Phase_2E::MCP_Tool_Layer[46_tool_tests_GREEN→git_f75ba76],
    Phase_2F::MCP_Server_Integration[344_352_tests_GREEN→git_c606295→PRODUCTION_VERIFIED_IN_WARP],
    Phase_2G::Enhanced_Direct_Tools[6_tools_exposed+knowledge_wrapper],
    Phase_2J::Field_Management[407_tests_GREEN→git_ac7bfd2→field_create+field_update],
    Phase_2K::Knowledge_Base_Migration[17_patterns+3_rule_sets→JSON_based→config/knowledge/],
    Phase_2L::Field_Operations_Fix[double_nesting_resolved→git_d5ec539→PRODUCTION_VALIDATED],
    Phase_4::User_Validation[all_7_tools_operational→field_operations_confirmed]
  ]
  PRODUCTION_STATUS::[
    ALL_TOOLS::OPERATIONAL[7_7_tools_working],
    QUALITY_GATES::GREEN[407_tests_passing+lint+typecheck],
    FIELD_OPERATIONS::VALIDATED[create+update_confirmed_with_real_API],
    KNOWLEDGE_BASE::PRODUCTION_READY[17_patterns_loaded_at_startup]
  ]
  BRANCH_STATUS::[
    feat/knowledge-base→5_commits_ahead[d5ec539_latest→ready_for_merge],
    main→needs_update[merge_feat/knowledge-base]
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
    DRY_RUN_SAFETY→mutation_protection_verification
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
    mutation_safety_verification
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

EMPIRICAL_VALIDATION_PROTOCOL::[
  NEW_MANDATORY_PROCESS::[
    LESSON_LEARNED::Pattern_852[multi_layer_payload_bug→3_4_false_completion_claims],
    CONSTITUTIONAL_REQUIREMENT::REALITY_principle[L20→production_conditions_trump_assumptions],

    BEFORE_CLAIMING_FIX_COMPLETE::[
      1→READ_SmartSuite_Truth_documentation[exact_API_contract_with_line_numbers],
      2→COMPARE_implementation_vs_documented_pattern[identify_gaps],
      3→ADD_diagnostic_logging[transformation_points_visible],
      4→RUN_quality_gates[lint+typecheck+test],
      5→USER_validates_with_real_API[empirical_evidence_REQUIRED],
      6→ONLY_THEN_claim_complete[no_validation_theater]
    ]

    VALIDATION_GATE::[
      BLOCK::completion_claims_without_empirical_API_evidence,
      REQUIRE::real_API_test_results_before_claiming_success,
      ENFORCE::SmartSuite_Truth_consultation_before_implementation
    ]

    PATTERN_852_PREVENTION::[
      SYMPTOM::API_400_errors_despite_unit_tests_passing,
      ROOT_CAUSE::coordinated_transformation_across_handler→client_layers,
      DETECTION::compare_actual_API_payload_vs_SmartSuite_Truth_contract,
      PREVENTION::diagnostic_logging+empirical_validation_MANDATORY,
      EVIDENCE::coordination/lessons-learned/852-PATTERN-MULTI-LAYER-PAYLOAD-BUG.md
    ]
  ]

  ORCHESTRATOR_ACCOUNTABILITY::[
    GAP_OWNERSHIP::orchestrator_owns_validation_gate_enforcement[L114],
    BLOCKING_AUTHORITY::prevent_false_completion_claims[L152],
    BUCK_STOPS_HERE::ultimate_accountability_for_validation_theater[L21]
  ]
]