# Database switcher in the title bar
Feature: move database switching from the connection sidebar to the application title bar.
Source: user request; implementation remains on the current feature branch.

## Specs
S1: "ahora en el sidebar se encuentra un combo/select para cambiar entre dbs, quiero q eso se pase a la barra superior del app donde se encuentra un badge de la conexion en la que estoy y se agregue otro badge que al darle click abra un componente que liste las dbs para cambiar,"
S2: "el RiCheckLine de @src/components/ui/select.tsx no se pinta bien por el contenido del nombre de la db [Image#4]se pinta uno sobre otro, tendria q haber una separacion, pero primero haz un commit de los cambios hasta el momento"
S3: "no lo achiques las opciones mas bien el listado se tendria q adaptara a la opcion mas larga o como un maximo prudente"

## Tasks
T1 | S1 | inline: render the workspace-owned selector in a title-bar slot without duplicating selection state | commit: 539985b
T2 | S1 | inline: move the database selector out of the sidebar and verify the title-bar flow | commit: 539985b
T3 | S2 | inline: reserve option space for the selected-item checkmark and update tests for the new title-bar selector | commit: 851543c, 84ea17b
T4 | S3 | inline: size the database option list to its longest label up to a prudent maximum | commit: 84ea17b

## Log
L1: ahora en el sidebar se encuentra un combo/select para cambiar entre dbs, quiero q eso se pase a la barra superior del app donde se encuentra un badge de la conexion en la que estoy y se agregue otro badge que al darle click abra un componente que liste las dbs para cambiar,
L2: Keep selected-database ownership in the workspace controller; render its selector through a title-bar portal slot so the header can use the same list, selection, and callback without a duplicate store or state synchronization.
L3: el RiCheckLine de @src/components/ui/select.tsx no se pinta bien por el contenido del nombre de la db [Image#4]se pinta uno sobre otro, tendria q haber una separacion, pero primero haz un commit de los cambios hasta el momento
L4: no lo achiques las opciones mas bien el listado se tendria q adaptara a la opcion mas larga o como un maximo prudente
L5: Feature source slice closes at 84ea17b (429 authored changed lines); preserve the recorded work-unit boundary and do not add unrelated scope to this slice.
