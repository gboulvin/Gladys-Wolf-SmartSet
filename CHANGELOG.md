# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Wolf SmartSet integration: sign-in to the Wolf SmartSet cloud with the
  account of the Wolf app or portal, one Gladys device per Wolf system, one
  feature per parameter (temperature probes, pressure, power, energy,
  operating hours, percentages, texts).
- Control from Gladys: writable temperatures become thermostat setpoints, lists
  of choices (operating modes, programs) become choice lists.
- Cloud transport badge per system: `cloud` while the Wolf gateway is online,
  `unreachable` when it is offline.
- Scene triggers: Wolf gateway connection changed, Wolf mode or state changed.
- Scene actions: read a Wolf system now, change a Wolf parameter, read a Wolf
  parameter.
- Dashboard widget "Wolf system": live temperatures and pressure, gateway
  connection, last read, current modes and a Refresh button.
- Configuration actions: test the connection, list the writable parameters of
  a system with their identifiers.
- Parameter names translated by Wolf SmartSet in English, French, German or
  Spanish, and an expert mode publishing every parameter of the controller.
- Interface and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/gboulvin/Gladys-Wolf-SmartSet/commits/main
