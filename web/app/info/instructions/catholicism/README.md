# Catholicism — Order of Mass

Bringing clarity to the Catholic Mass by providing printable, date-specific pamphlets with all prayers, responses, and Scripture readings for each day's liturgy.

## What's Here

### Daily Pamphlets — `order-of-mass-yyyy-mm-dd.html`

Self-contained HTML files designed for print. Each pamphlet includes:

- All congregational prayers and responses (bold text = your part)
- The day's proper readings: First Reading, Responsorial Psalm, Second Reading, Gospel
- Liturgical season, color, and calendar designation (e.g., "Second Sunday of Lent")
- Season-specific rubrics (e.g., Gloria omitted during Lent, Alleluia replaced)

**Print instructions:** Open in a browser → Ctrl+P → Landscape → Print on both sides (flip on long edge). The 4-panel grid layout reads left-to-right, top-to-bottom per column. Fold in half for a pocket booklet.

### BPMN Diagram — `order-of-mass-bpmn.svg`

A high-level process diagram of the Ordinary Form (Roman Rite) Mass. Four swim lanes map the major phases:

| Phase | Key Activities |
|---|---|
| Introductory Rites | Entrance, Greeting, Penitential Act, Kyrie, Gloria (conditional), Collect |
| Liturgy of the Word | First Reading, Psalm, Second Reading, Gospel Acclamation, Gospel, Homily, Creed, Universal Prayer |
| Liturgy of the Eucharist | Preparation, Preface, Sanctus, Eucharistic Prayer, Lord's Prayer, Sign of Peace, Communion |
| Concluding Rites | Blessing, Dismissal |

Decision gateways capture seasonal variations (Lent skips Gloria and Alleluia; Solemnities always include Gloria).

## What Varies by Day

The Ordinary (fixed) parts of Mass stay the same. The Proper (variable) parts change daily:

- **Readings** — assigned by the Lectionary (3-year Sunday cycle A/B/C, 2-year weekday cycle I/II)
- **Responsorial Psalm** — paired with the First Reading
- **Gospel Acclamation** — Alleluia outside Lent; "Praise to you, Lord Jesus Christ..." during Lent
- **Gloria** — omitted during Advent and Lent (except Solemnities)
- **Liturgical color** — Purple (Advent/Lent), White (Christmas/Easter/feasts), Green (Ordinary Time), Red (martyrs/Pentecost/Palm Sunday)
- **Collect, Prayer over the Offerings, Prayer after Communion** — proper to each day

## Generation Service

The `services/mass-guide-agent/` generates these pamphlets automatically.

```
cd services/mass-guide-agent
npm run generate            # generates next 30 days
npm run generate -- --days 7   # or a custom range
```

The agent fetches liturgical calendar data (readings, season, color) for each date, renders the HTML template, and writes the output here. It is designed to run on a schedule (cron or CI) so the website always has upcoming pamphlets available.
