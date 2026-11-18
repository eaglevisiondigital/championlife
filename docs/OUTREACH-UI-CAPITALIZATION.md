# Outreach UI capitalization

Local copy-only follow-up from `f9ae106dce1a026bb3f7134ac5af0f593d29f3cb`. Not deployed by this change. Short headings, controls, labels and enum display text use title capitalization; complete sentences and legal/waiver wording remain in sentence case. The three local `stateLabel` helpers format only text sinks; option values, predicates, request payloads and stored statuses remain unchanged. No notification, SQL, Auth, manifest, deployment, account or grant changes.

The short Minden label “Any Additional Information?” changes case only. Its words, question mark, field key, validation and optional status are unchanged. Complete approved questions and answers retain their wording and case. Intentional uppercase brand eyebrows remain styled as before; “Go With SOWGO” is a standalone label.

Canonical Discipleship login, shared Auth/session files, Outreach login generator and generated inline Auth remain byte-identical. Outreach login changes only its skip-link and logo accessibility label. Shared Dream Track edits are confined to the staff shell/navigation. No architecture or security policy changes.

## Exact presentation string inventory

### `assets/js/minden-volunteer.js`

| Before | After |
| --- | --- |
| Sending application… | Sending Application… |
| Application received | Application Received |
| Submit volunteer application | Submit Volunteer Application |

### `assets/js/outreach-people.js`

| Before | After |
| --- | --- |
| Sign in to your workspace | Sign In to Your Workspace |
| Search contacts | Search Contacts |
| Search by name, email or phone | Search by Name, Email or Phone |
| Review Person & follow-up | Review Person & Follow-Up |
| Organization relationships | Organization Relationships |
| Follow-up tasks | Follow-Up Tasks |
| No due date | No Due Date |
| Save task status | Save Task Status |

### `assets/js/outreach-registration-form.js`

| Before | After |
| --- | --- |
| 1. Your information | 1. Your Information |
| Your household | Your Household |
| Primary adult first name | Primary Adult First Name |
| Primary adult last name | Primary Adult Last Name |
| Mobile phone | Mobile Phone |
| Street address | Street Address |
| Address line 2 (optional) | Address Line 2 (Optional) |
| Postal / ZIP code | Postal / ZIP Code |
| Add attendee | Add Attendee |
| Add child | Add Child |
| Add adult | Add Adult |
| 3. Minors / household | 3. Minors / Household |
| 4. Release & waiver | 4. Release & Waiver |
| Household waiver & signature | Household Waiver & Signature |
| Complete the optional event waiver | Complete the Optional Event Waiver |
| Typed legal name | Typed Legal Name |
| Signer relationship | Signer Relationship |
| Legal guardian | Legal Guardian |
| Authorized adult | Authorized Adult |
| Attendee first name | Attendee First Name |
| Attendee last name | Attendee Last Name |
| Relationship to primary | Relationship to Primary |
| Guardian relationship (required for minors) | Guardian Relationship (Required for Minors) |
| No preference | No Preference |
| Participate in eligible prizes | Participate in Eligible Prizes |
| Interested in a bike | Interested in a Bike |
| Tablet only | Tablet Only |
| Prize preference | Prize Preference |
| 5. Media release | 5. Media Release |
| Media release | Media Release |
| Media release initials | Media Release Initials |
| 6. Emergency contact | 6. Emergency Contact |
| Emergency contact | Emergency Contact |
| Emergency telephone number | Emergency Telephone Number |
| Optional consent | Optional Consent |
| Ministry follow-up | Ministry Follow-Up |
| Event communications | Event Communications |
| Marketing communications | Marketing Communications |
| Photo/media release | Photo/Media Release |
| 8. Review & submit | 8. Review & Submit |
| Submit household registration | Submit Household Registration |

### `assets/js/outreach-registration-staff.js`

| Before | After |
| --- | --- |
| Sign in to continue | Sign In to Continue |
| Registration access unavailable | Registration Access Unavailable |
| SIGN IN | Sign In |
| RETURN TO STAFF DASHBOARD | Return to Staff Dashboard |
| Add walk-up | Add Walk-Up |
| Print backup roster | Print Backup Roster |
| Campaign attendance totals | Campaign Attendance Totals |
| Campaign totals | Campaign Totals |
| Total attending | Total Attending |
| Event-day check-in totals (separate) | Event-Day Check-In Totals (Separate) |
| Checked in adults | Checked In Adults |
| Checked in kids | Checked In Kids |
| Total checked in | Total Checked In |
| Household lookup | Household Lookup |
| Name, phone, email or reference | Name, Phone, Email or Reference |
| Open household | Open Household |
| Emergency phone:  | Emergency Phone:  |
| Media consent:  | Media Consent:  |
| Edit household | Edit Household |
| First name | First Name |
| Last name | Last Name |
| Emergency phone | Emergency Phone |
| Private operational notes | Private Operational Notes |
| Street address | Street Address |
| Address line 2 | Address Line 2 |
| Postal / ZIP code | Postal / ZIP Code |
| Registration status | Registration Status |
| Save household | Save Household |
| Attendees & check-in | Attendees & Check-In |
| Waiver covered | Waiver Covered |
| Waiver missing | Waiver Missing |
| Checked in ·  | Checked In ·  |
| Not checked in | Not Checked In |
| Not participating | Not Participating |
| Present and eligible | Present and Eligible |
| Event-day check-in required | Event-Day Check-In Required |
| No prize participation | No Prize Participation |
| Wristband/reference:  | Wristband/Reference:  |
| Wristband/reference (optional) | Wristband/Reference (Optional) |
| Check in attendee | Check In Attendee |
| Reason for check-in correction | Reason for Check-In Correction |
| Reverse check-in | Reverse Check-In |
| Update attendee | Update Attendee |
| Guardian relationship | Guardian Relationship |
| Operational notes | Operational Notes |
| Save attendee | Save Attendee |
| Remove attendee | Remove Attendee |
| Waiver signatures | Waiver Signatures |
| Signed media release | Signed Media Release |
| Reason for waiver correction | Reason for Waiver Correction |
| Invalidate signature with correction | Invalidate Signature with Correction |
| Prize participation | Prize Participation |
| Bike interest | Bike Interest |
| Tablet only | Tablet Only |
| Prize preference | Prize Preference |
| No preference | No Preference |
| Add household attendee | Add Household Attendee |
| Add attendee | Add Attendee |
| Record a new household signature | Record a New Household Signature |
| Signer typed legal name | Signer Typed Legal Name |
| Signer relationship | Signer Relationship |
| Legal guardian | Legal Guardian |
| Authorized adult | Authorized Adult |
| Recorded household media choice:  | Recorded Household Media Choice:  |
| Media release initials | Media Release Initials |
| Record signature | Record Signature |
| Walk-up household | Walk-Up Household |
| Private campaign backup roster | Private Campaign Backup Roster |
| Check-in | Check-In |
| Checked in | Checked In |
| Print private roster | Print Private Roster |
| Registration configuration | Registration Configuration |
| Public campaign slug | Public Campaign Slug |
| Enable public registration | Enable Public Registration |
| Require address | Require Address |
| Require waiver for all attending members | Require Waiver for All Attending Members |
| Household limit (blank = unlimited) | Household Limit (Blank = Unlimited) |
| Opens at | Opens At |
| Closes at | Closes At |
| Event-day instructions | Event-Day Instructions |
| Prize choices JSON | Prize Choices JSON |
| Exact mapped fields JSON | Exact Mapped Fields JSON |
| Save registration configuration | Save Registration Configuration |
| Publish approved waiver version | Publish Approved Waiver Version |
| Reusable template key | Reusable Template Key |
| Effective date/time | Effective Date/Time |
| Exact approved waiver text | Exact Approved Waiver Text |
| Exact approved media release text | Exact Approved Media Release Text |
| Media consent required by reviewed source | Media Consent Required by Reviewed Source |
| Media initials required by reviewed source | Media Initials Required by Reviewed Source |
| Publish immutable version | Publish Immutable Version |
| Explicit registration access | Explicit Registration Access |
| Access review reason | Access Review Reason |
| Save registration capabilities | Save Registration Capabilities |
| Choose an outreach campaign | Choose an Outreach Campaign |

### `assets/js/outreach-team-portal.js`

| Before | After |
| --- | --- |
| Team selection pending | Team Selection Pending |
| Under review | Under Review |
| Approved to serve | Approved to Serve |
| Not selected | Not Selected |
| Open your event link | Open Your Event Link |
| Sign in to view your outreach information | Sign In to View Your Outreach Information |
| Sign in | Sign In |
| Refresh my information | Refresh My Information |
| Your outreach record | Your Outreach Record |
| Your serving record | Your Serving Record |
| Application record | Application Record |
| Previous team decision | Previous Team Decision |
| Team decision | Team Decision |
| Your attendance history | Your Attendance History |
| Checked in:  | Checked In:  |
| Your travel information | Your Travel Information |
| Confirmed travel leg | Confirmed Travel Leg |
| Confirmed itinerary | Confirmed Itinerary |
| Meet at | Meet At |
| Try Log Out again | Try Log Out Again |

### `assets/js/outreach-team-travel.js`

| Before | After |
| --- | --- |
| Review reason (at least 10 characters) | Review Reason (at Least 10 Characters) |
| Outreach access unavailable | Outreach Access Unavailable |
| Sign in | Sign In |
| Save review | Save Review |
| Team and travel views | Team and Travel Views |
| Team review | Team Review |
| Vehicles & travel | Vehicles & Travel |
| Team decisions | Team Decisions |
| Individual participants | Individual Participants |
| Team decision | Team Decision |
| Travel eligibility | Travel Eligibility |
| Reviewed for travel | Reviewed for Travel |
| Review required | Review Required |
| Checked in | Checked In |
| Not checked in | Not Checked In |
| Volunteer applications | Volunteer Applications |
| Source status | Source Status |
| View application | View Application |
| Review and link | Review and Link |
| Previous applications | Previous Applications |
| More applications | More Applications |
| Not supplied | Not Supplied |
| Attendance answer | Attendance Answer |
| Not answered | Not Answered |
| RV / big rig experience (self-report) | RV / Big Rig Experience (Self-Report) |
| Ride preference | Ride Preference |
| Ride with team | Ride with Team |
| Drive self | Drive Self |
| Prospective passenger names — unverified | Prospective Passenger Names — Unverified |
| None supplied | None Supplied |
| Additional information | Additional Information |
| Back to team | Back to Team |
| Find the verified canonical Person | Find the Verified Canonical Person |
| No email on record | No Email on Record |
| Create a new Person after match review | Create a New Person After Match Review |
| Create a separate canonical Person | Create a Separate Canonical Person |
| Review created Person for linking | Review Created Person for Linking |
| Create canonical Person | Create Canonical Person |
| Reviewed first name | Reviewed First Name |
| Reviewed last name | Reviewed Last Name |
| Reviewed email (optional) | Reviewed Email (Optional) |
| Reviewed phone (optional) | Reviewed Phone (Optional) |
| Name or contact search | Name or Contact Search |
| Confirm verified identity | Confirm Verified Identity |
| Link verified Person | Link Verified Person |
| Team decision:  | Team Decision:  |
| Travel eligibility:  | Travel Eligibility:  |
| Save individual decision | Save Individual Decision |
| Individual team decision | Individual Team Decision |
| Availability and age review | Availability and Age Review |
| Save availability review | Save Availability Review |
| Availability independently confirmed | Availability Independently Confirmed |
| Unconfirmed / unavailable | Unconfirmed / Unavailable |
| Save verified age | Save Verified Age |
| Verified age for the outreach travel date | Verified Age for the Outreach Travel Date |
| Guardian authority review | Guardian Authority Review |
| Save verified guardian authority | Save Verified Guardian Authority |
| Verified guardian / Household | Verified Guardian / Household |
| Review canonical Household setup | Review Canonical Household Setup |
| Event attendance | Event Attendance |
| Record attendance review | Record Attendance Review |
| Attendance action | Attendance Action |
| Check in | Check In |
| Mark attended after check-in | Mark Attended After Check-In |
| Reverse check-in and attendance | Reverse Check-In and Attendance |
| Review history | Review History |
| Authorized staff reviewer | Authorized Staff Reviewer |
| Canonical Household setup for  | Canonical Household Setup for  |
| Return to guardian authority review | Return to Guardian Authority Review |
| Create a separate Household after match review | Create a Separate Household After Match Review |
| Create a separate Household | Create a Separate Household |
| Review created Household | Review Created Household |
| Create reviewed Household | Create Reviewed Household |
| Reviewed Household name | Reviewed Household Name |
| Search canonical Households | Search Canonical Households |
| Household name search | Household Name Search |
| Existing factual memberships | Existing Factual Memberships |
| Household label | Household Label |
| Add reviewed Household membership | Add Reviewed Household Membership |
| Reviewed Person for this membership | Reviewed Person for This Membership |
| Factual Household label — not legal authority | Factual Household Label — Not Legal Authority |
| Vehicle capacity by travel leg | Vehicle Capacity by Travel Leg |
| Travel leg | Travel Leg |
| Total seats | Total Seats |
| Passenger limit | Passenger Limit |
| Available passenger seats | Available Passenger Seats |
| Travel legs | Travel Legs |
| Times unconfirmed | Times Unconfirmed |
| Add travel leg | Add Travel Leg |
| Vehicle roster | Vehicle Roster |
| Add vehicle | Add Vehicle |
| Seat reservations | Seat Reservations |
| Confirm itinerary | Confirm Itinerary |
| Reassign / cancel | Reassign / Cancel |
| Edit travel leg | Edit Travel Leg |
| Save travel leg | Save Travel Leg |
| Travel leg label | Travel Leg Label |
| Confirmed departure time ( | Confirmed Departure Time ( |
| Arrival time, if confirmed ( | Arrival Time, if Confirmed ( |
| Departure location | Departure Location |
| Itinerary confirmation | Itinerary Confirmation |
| Details unconfirmed | Details Unconfirmed |
| Departure, locations and details verified | Departure, Locations and Details Verified |
| Edit vehicle | Edit Vehicle |
| Save vehicle | Save Vehicle |
| Vehicle label | Vehicle Label |
| Vehicle type | Vehicle Type |
| Total seats including driver | Total Seats Including Driver |
| Passenger seat limit | Passenger Seat Limit |
| Accessible passenger seats, if verified | Accessible Passenger Seats, if Verified |
| Passenger carrying | Passenger Carrying |
| May carry passengers | May Carry Passengers |
| Equipment only | Equipment Only |
| Roster status | Roster Status |
| Operational vehicle notes | Operational Vehicle Notes |
| Assign an approved participant | Assign an Approved Participant |
| Reserve seat | Reserve Seat |
| Reviewed participant | Reviewed Participant |
| Seat role | Seat Role |
| Responsible driver | Responsible Driver |
| Driver qualification review | Driver Qualification Review |
| Qualified by staff review | Qualified by Staff Review |
| Not qualified | Not Qualified |
| Save driver qualification | Save Driver Qualification |
| Reviewed adult participant | Reviewed Adult Participant |
| Specific vehicle | Specific Vehicle |
| Independent qualification decision | Independent Qualification Decision |
| Qualified for this vehicle | Qualified for This Vehicle |
| Not qualified / revoke qualification | Not Qualified / Revoke Qualification |
| Review assignment change | Review Assignment Change |
| Save assignment change | Save Assignment Change |
| Reassign on the same travel leg | Reassign on the Same Travel Leg |
| Cancel this seat | Cancel This Seat |
| Replacement vehicle (for reassignment) | Replacement Vehicle (for Reassignment) |
| Replacement seat role (for reassignment) | Replacement Seat Role (for Reassignment) |
| Private travel manifest | Private Travel Manifest |
| Current reserved seats | Current Reserved Seats |
| Current itinerary | Current Itinerary |
| View manifest | View Manifest |
| Vehicle (optional) | Vehicle (Optional) |
| Download scoped CSV | Download Scoped CSV |
| Print scoped manifest | Print Scoped Manifest |
| Travel leg:  | Travel Leg:  |
| Unconfirmed / review required | Unconfirmed / Review Required |

### `assets/js/staff-outreach-partners.js`

| Before | After |
| --- | --- |
| Sign in to your workspace | Sign In to Your Workspace |
| Follow-up:  | Follow-Up:  |
| Review intake | Review Intake |
| Back to intakes | Back to Intakes |
| Partner intake ·  | Partner Intake ·  |
| Mark reviewed | Mark Reviewed |
| Open Person / follow-up tasks | Open Person / Follow-Up Tasks |
| Create follow-up task | Create Follow-Up Task |
| Review contact identity | Review Contact Identity |
| Search existing contacts | Search Existing Contacts |
| Link reviewed contact | Link Reviewed Contact |
| Create contact after review | Create Contact After Review |
| Review history | Review History |

### `assets/js/staff-outreach-volunteers.js`

| Before | After |
| --- | --- |
| Pause public intake | Pause Public Intake |
| Enable public intake | Enable Public Intake |
| Review application | Review Application |
| Previous applications | Previous Applications |
| Next applications | Next Applications |
| Back to applications | Back to Applications |
| Any additional information? | Any Additional Information? |
| Review status | Review Status |
| Private review note | Private Review Note |
| Save review | Save Review |
| Confirmation delivery | Confirmation Delivery |
| Delivery not yet confirmed | Delivery Not Yet Confirmed |
| Review delivery in Resend | Review Delivery in Resend |
| Retry pending confirmation | Retry Pending Confirmation |
| Application history | Application History |
| Sign in to volunteer review | Sign In to Volunteer Review |

### `minden-serve.html`

| Before | After |
| --- | --- |
| Skip to application | Skip to Application |
| SOWGO home | SOWGO Home |
| Outreach opportunities | Outreach Opportunities |
| Go with SOWGO | Go With SOWGO |
| Minden volunteer application | Minden Volunteer Application |
| Before you apply | Before You Apply |
| Volunteer application | Volunteer Application |
| Any additional information? | Any Additional Information? |
| Submit volunteer application | Submit Volunteer Application |

### `outreach-login.html`

| Before | After |
| --- | --- |
| Skip to sign in | Skip to Sign In |
| SOWGO Outreach home | SOWGO Outreach Home |

### `outreach-team.html`

| Before | After |
| --- | --- |
| Skip to your outreach information | Skip to Your Outreach Information |
| Champion Life home | Champion Life Home |
| Signed in as | Signed In As |

### `staff-dream-track.html`

| Before | After |
| --- | --- |
| Skip to workspace | Skip to Workspace |
| Staff navigation | Staff Navigation |
| Champion Life home | Champion Life Home |
| Staff workspace | Staff Workspace |
| Staff workspace | Staff Workspace |
| People & Follow-up | People & Follow-Up |
| Staff portal | Staff Portal |
| Signed in as | Signed In As |

### `staff-outreach-partners.html`

| Before | After |
| --- | --- |
| Skip to workspace | Skip to Workspace |
| Staff portal | Staff Portal |
| Signed in as | Signed In As |
| People workspace | People Workspace |

### `staff-outreach-registration.html`

| Before | After |
| --- | --- |
| Skip to workspace | Skip to Workspace |
| Registration navigation | Registration Navigation |
| Champion Life home | Champion Life Home |
| Staff workspace | Staff Workspace |
| People & Follow-up | People & Follow-Up |
| Staff portal | Staff Portal |
| Signed in as | Signed In As |

### `staff-outreach-team-travel.html`

| Before | After |
| --- | --- |
| Skip to workspace | Skip to Workspace |
| Champion Life home | Champion Life Home |
| People & Follow-up | People & Follow-Up |
| Champion Life / Outreach operations | Champion Life / Outreach Operations |
| Signed in as | Signed In As |

### `staff-outreach-volunteers.html`

| Before | After |
| --- | --- |
| Volunteer applications · Champion Life | Volunteer Applications · Champion Life |
| Skip to workspace | Skip to Workspace |
| Staff navigation | Staff Navigation |
| Champion Life home | Champion Life Home |
| Staff workspace | Staff Workspace |
| Staff workspace | Staff Workspace |
| People & Follow-up | People & Follow-Up |
| Volunteer applications | Volunteer Applications |
| Staff portal | Staff Portal |
| Signed in as | Signed In As |

### `staff-people.html`

| Before | After |
| --- | --- |
| People & Follow-up · Champion Life | People & Follow-Up · Champion Life |
| Skip to workspace | Skip to Workspace |
| Staff navigation | Staff Navigation |
| Champion Life home | Champion Life Home |
| Staff workspace | Staff Workspace |
| Staff workspace | Staff Workspace |
| People & Follow-up | People & Follow-Up |
| Volunteer applications | Volunteer Applications |
| Staff portal | Staff Portal |
| Signed in as | Signed In As |
| People & ministry care | People & Ministry Care |

## Dynamic state display

The P0 review, P1 Team/Travel and registration staff scripts apply the local display formatter only to summary/table/detail/history text and option labels. For example `pending` → “Pending”, `under_review` → “Under Review”, `not_selected` → “Not Selected”, `checked_in` → “Checked In”, `passenger` → “Passenger”, and `assigned` → “Assigned”. Underscores/dots become display spaces; every input/API value remains the original enum. The P1 co-driver option label is “Co-Driver”; its value stays `co_driver`. Names, contact text, free-form notes, provider errors, approved questions and raw audit metadata are not passed through this formatter.

## Validation

Existing DOM tests retain their cases and update exact visible-copy expectations. P0 and P1 tests explicitly verify title-case option labels alongside original enum values and submitted status payloads. Private preservation verification compares the complete JavaScript AST after reversing the bounded display-sink edits, checks HTML structure/attributes and exact embedded runtime bytes, and pins canonical Auth/session/generator/manifest files. Focused test results are recorded in the task handoff; hosted/browser acceptance and publication belong to the release owner.

## Final visual follow-up

The workflow row is a series of short labels, so it uses the same title capitalization: “Application Received → Individual Approval → Vehicle Assignment → Confirmed Itinerary → Check-In → Attended.” Only case changes; progression, state values and behavior are unchanged. This adds one presentation string to the original inventory.
