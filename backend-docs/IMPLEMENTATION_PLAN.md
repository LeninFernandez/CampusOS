# CampusOS Implementation Authority

## Source of Truth

The following documents are authoritative:

1. FINAL_API_CONTRACT.md
2. FINAL_TEAM_BUILD_GUIDE.md

These documents override all other documentation.

## Supporting Documents

The following documents are references only:

- API_AND_DATABASE_SPEC.md
- ARCHITECTURE.md
- DECISIONS.md

If any conflict exists:
1. Follow FINAL_API_CONTRACT.md
2. Follow FINAL_TEAM_BUILD_GUIDE.md
3. Ignore conflicting information from supporting documents

## Implementation Rules

- Do not invent APIs.
- Do not invent database fields.
- Do not invent permissions.
- Do not add features outside MVP scope.
- Ask before changing frozen contracts.

Before implementing any module:
- Verify endpoints against FINAL_API_CONTRACT.md.
- Verify database rules against FINAL_TEAM_BUILD_GUIDE.md.
- Verify authorization against role definitions.
