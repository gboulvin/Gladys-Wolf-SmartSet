# Wolf SmartSet

Monitor and control your **Wolf** heating system (gas and oil condensing
boilers, heat pumps, ventilation units, solar modules...) from Gladys, through
the **Wolf SmartSet** cloud.

## Before you start

- Your installation must be connected to Wolf SmartSet through a Wolf gateway
  (**ISM7**, **Link home**, **Link pro**...) and visible in the
  [Wolf SmartSet portal](https://www.wolf-smartset.com) or app.
- Keep the username and password of that account at hand. Wolf SmartSet only
  accepts passwords of **30 characters or less**.
- The integration talks to the Wolf cloud (it is a **cloud** integration):
  Gladys needs Internet access, and the values are as fresh as Wolf SmartSet
  makes them.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Enter your Wolf SmartSet **username** and **password**.
3. Pick the **language of the parameter names**: Wolf SmartSet translates the
   names of its parameters itself (English, French, German or Spanish).
4. Leave **Expert mode** off unless you need every parameter of the
   controller: off, you get the parameters the Wolf portal shows to the end
   user; on, every parameter of every menu (a lot more features).
5. The **refresh interval** sets how often the values are read from the Wolf
   cloud: every 2 minutes by default, every minute at most. The Wolf cloud is
   slow and rate-limited, keep it reasonable.
6. Save, then press **Test the connection**: the message under the button
   tells how many systems were found.
7. Open the **Discovery** tab: each Wolf system appears as one device, ready to
   be added.

## What you get

Each Wolf system becomes one Gladys device. Its features are the parameters of
the system, named by Wolf SmartSet, and mapped by their unit:

| Wolf parameter                                   | Gladys feature        | Controllable                            |
| ------------------------------------------------ | --------------------- | --------------------------------------- |
| Temperature (°C), read-only                      | Temperature probe     | no                                      |
| Temperature (°C), writable (room, hot water...)  | Thermostat setpoint   | **yes**                                 |
| Pressure (bar)                                   | Pressure sensor       | no                                      |
| Power (kW) / heat quantity (kWh)                 | Power / energy sensor | no                                      |
| Operating hours                                  | Duration              | no                                      |
| Percentage (modulation, pump...)                 | Value in %            | no                                      |
| List of choices (operating mode, program, state) | Choice list           | **yes**, when writable in Wolf SmartSet |
| Anything else (rpm, l/min, Hz, text...)          | Text with its unit    | no                                      |

The badge of the device shows **cloud** while its gateway reaches Wolf
SmartSet, and **unreachable** when the gateway is offline.

To find the writable parameters of a system and their identifiers, press
**List the writable parameters** in the Configuration tab.

## Scenes

**Triggers**

- **Wolf gateway connection changed**: the gateway of a system went online or
  offline. Filter on the system and the status; the scene receives
  `{{triggerEvent.data.status}}` (`online` / `offline`).
- **Wolf mode or state changed**: a parameter with choices (operating mode,
  program, burner state...) took a new value. The scene receives the
  parameter name, its identifier, the new and the previous value. A change
  made by Gladys itself never fires it.

The numeric values (temperatures, pressure...) are device features: use the
standard "device state" trigger of Gladys for thresholds.

**Actions**

- **Read a Wolf system now**: reads every value without waiting for the
  refresh interval. Outputs: gateway online, number of values read.
- **Change a Wolf parameter**: writes a setpoint, a mode or any writable
  parameter. The parameter is given by its name or its identifier; the value
  of a choice list is its label (e.g. `Eco`) or its number. Outputs: the
  parameter and the written value.
- **Read a Wolf parameter**: makes one value available to the following
  actions of the scene (as text, raw and numeric).

## Dashboard widget

The **Wolf system** widget shows the main temperatures and the pressure of a
system (live), the gateway connection, the last read and the current operating
modes, with a **Refresh** button. Choose the system in the widget settings (the
first one otherwise).

## Troubleshooting

- **"Wolf SmartSet refused the username or the password"**: check them in the
  Wolf SmartSet portal; shorten the password to 30 characters if needed.
- **No device in Discovery**: press **Test the connection**; the account must
  own at least one system.
- **Values stop updating, badge "unreachable"**: the Wolf gateway lost its
  connection: check its power and network.
- **A parameter is missing**: turn on **Expert mode**.

This integration uses the same Wolf SmartSet web services as the Wolf portal;
they are not a public API and may change without notice.
