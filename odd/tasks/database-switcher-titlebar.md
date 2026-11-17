# Database switcher in the title bar
Feature: move database switching from the connection sidebar to the application title bar.
Source: user request; implementation remains on the current feature branch.

## Specs
S1: "ahora en el sidebar se encuentra un combo/select para cambiar entre dbs, quiero q eso se pase a la barra superior del app donde se encuentra un badge de la conexion en la que estoy y se agregue otro badge que al darle click abra un componente que liste las dbs para cambiar,"

## Tasks
T1 | S1 | inline: render the workspace-owned selector in a title-bar slot without duplicating selection state | commit: pending
T2 | S1 | inline: move the database selector out of the sidebar and verify the title-bar flow | commit: pending

## Log
L1: ahora en el sidebar se encuentra un combo/select para cambiar entre dbs, quiero q eso se pase a la barra superior del app donde se encuentra un badge de la conexion en la que estoy y se agregue otro badge que al darle click abra un componente que liste las dbs para cambiar,
L2: Keep selected-database ownership in the workspace controller; render its selector through a title-bar portal slot so the header can use the same list, selection, and callback without a duplicate store or state synchronization.
