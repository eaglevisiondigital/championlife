alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage']::text[]));
create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='' as $$ select array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage']::text[] $$;
-- Restricted application domain: browser access only through identity/permission checked RPCs.
create table private.dream_team_forms(version text primary key,definition jsonb not null);
insert into private.dream_team_forms values ('dream-team-v1-20261002',$source${
  "version": "dream-team-v1-20261002",
  "ethicsVersion": "dream-team-ethics-20261001",
  "sourceSha256": "8620cb3ec7c1bcf061996dddb6e6ac56c221b1368a765e714300b769378b3132",
  "pages": [
    {
      "number": 1,
      "blocks": [
        {
          "id": "cid_10",
          "text": "Dream Team Application\n            Please complete the form below to be considered for volunteer positions available. Any information provided is kept confidential."
        }
      ]
    },
    {
      "number": 2,
      "blocks": [
        {
          "id": "cid_46",
          "text": "Lifestyle\n            Please note, answering Yes to any of these questions does not necessarily mean you cannot serve on a Team. We believe in God's mercy and the opportunity to grow as we continually seek to be more like Him. Only Senior Pastors can make a decision to Approve or Deny a person to serve on a team."
        }
      ]
    },
    {
      "number": 3,
      "blocks": [
        {
          "id": "cid_48",
          "text": "Medical"
        }
      ]
    },
    {
      "number": 4,
      "blocks": [
        {
          "id": "cid_52",
          "text": "Christian Experience"
        }
      ]
    },
    {
      "number": 5,
      "blocks": [
        {
          "id": "cid_63",
          "text": "Previous Church \n            Please provide where you have attended church in the past 3 years."
        }
      ]
    },
    {
      "number": 6,
      "blocks": [
        {
          "id": "cid_78",
          "text": "DREAM TEAM CODE OF ETHICS\n            Levels 1-2-3"
        },
        {
          "id": "id_76",
          "text": "General Code of Ethics For Levels 1-2-3 Dream Team Members\n            1. I will conduct myself in a manner that does not bring reproach on the cause of Christ.\n            2. I will not engage in illicit sexual activity or moral impurity including cohabitation, adultery, or improper physical contact with children.\n            3. I will not engage in any homosexual or transgender activity.\n            4. I will abstain from all appearances of evil, in consideration of I Thessalonians 5:22.\n            5. I will subscribe to the doctrinal beliefs of Champion Life, and I will not communicate to my fellow workers/students anything that contradicts the Champion Life doctrinal statement. I Corinthians 1:10\n            6. I will refrain from participation in gossip, murmuring and complaining about church leaders, fellow church members and policies.  I will address my concerns to the appropriate person in charge in a civil and Christ-like manner.  Should I find it impossible to resolve my grievance, I will resign my position in a manner considerate of the on-going program. I Corinthians 1:10, 2 Corinthians 12:20, I Thessalonians 5:12\n            7. I will faithfully serve my team without chronic absenteeism, tardiness or lack of preparation. I will follow the notification process if I am unable to serve in my scheduled area. I will never fail to notify my Department Lead of my absence.  I understand that chronic absenteeism, tardiness and lack of preparedness are grounds for dismissal. Luke 16:12\n            8. I will maintain an appearance that is neat and clean, and is not distracting, provocative or excessively revealing. I will follow directions on dress and appearance as communicated by my Department Lead and Church Leadership.\n            9. I will attend adult services at least once weekly in addition to serving in my area. Hebrews 10:25\n            10. I will maintain a cheerful disposition, work in the spirit of faith and rebuff those who endeavor to introduce negative attitudes.\n            11. I will listen to and/or watch assigned audio and videos including but not limited to live streams from dates I served when I am not able to sit in a corresponding Sunday morning service.\n            12. I will make a 6 month commitment to any area I serve in and will give at least a 30 day notice if I need to step down from that position.\n             \n            Additional Code of Ethics For Level 2 & 3 Dream Team Members\n            13. I will refrain from drinking alcoholic beverages.\n            14. I will refrain from using tobacco products including chewing tobacco, cigars, cigarettes and e-cigarettes.\n            15. I will refrain from using mind altering drugs including marijuana, illegal drugs, or abuse of perscription drugs.\n            16. I will not engage in any form of pornography.\n            17. I have or will complete GET A GRIP ON THE BASICS 13 week discipleship course.\n            18. I have or will complete the Dream Track Videos in the next 3 months.\n            19. I will be a faithful tither and support the church with my offerings. Malachi 3:10"
        }
      ]
    },
    {
      "number": 7,
      "blocks": []
    },
    {
      "number": 8,
      "blocks": [
        {
          "id": "cid_69",
          "text": "Applicant Signature"
        }
      ]
    }
  ],
  "fields": [
    {
      "id": "id_11",
      "order": 1,
      "page": 1,
      "label": "Full Name*",
      "type": "fullname",
      "required": true,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [
        "First Name",
        "Middle Name",
        "Last Name"
      ],
      "controls": [
        {
          "id": "first_11",
          "label": "First Name",
          "type": "text",
          "required": true
        },
        {
          "id": "middle_11",
          "label": "Middle Name",
          "type": "text",
          "required": false
        },
        {
          "id": "last_11",
          "label": "Last Name",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_16",
      "order": 2,
      "page": 1,
      "label": "Current Address*",
      "type": "address",
      "required": true,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [
        "Street Address",
        "Street Address Line 2",
        "City",
        "State / Province",
        "Postal / Zip Code"
      ],
      "controls": [
        {
          "id": "input_16_addr_line1",
          "label": "Street Address",
          "type": "text",
          "required": true,
          "maxLength": 100
        },
        {
          "id": "input_16_addr_line2",
          "label": "Street Address Line 2",
          "type": "text",
          "required": false,
          "maxLength": 100
        },
        {
          "id": "input_16_city",
          "label": "City",
          "type": "text",
          "required": true,
          "maxLength": 60
        },
        {
          "id": "input_16_state",
          "label": "State / Province",
          "type": "text",
          "required": true,
          "maxLength": 60
        },
        {
          "id": "input_16_postal",
          "label": "Postal / Zip Code",
          "type": "text",
          "required": true,
          "maxLength": 20
        }
      ]
    },
    {
      "id": "id_13",
      "order": 3,
      "page": 1,
      "label": "Phone Number*",
      "type": "phone",
      "required": true,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_13_full",
          "label": "Phone Number*",
          "type": "tel",
          "required": true,
          "placeholder": "(000) 000-0000"
        }
      ]
    },
    {
      "id": "id_12",
      "order": 4,
      "page": 1,
      "label": "Email Address*",
      "type": "email",
      "required": true,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [
        "example@example.com"
      ],
      "controls": [
        {
          "id": "input_12",
          "label": "example@example.com",
          "type": "email",
          "required": true,
          "placeholder": "ex: myname@example.com"
        }
      ]
    },
    {
      "id": "id_18",
      "order": 5,
      "page": 1,
      "label": "Birth Date*",
      "type": "birthdate",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [
        "Month",
        "Day",
        "Year"
      ],
      "controls": [
        {
          "id": "input_18_month",
          "label": "Month",
          "type": "select",
          "required": true,
          "options": [
            {
              "value": "",
              "text": "Please select a month"
            },
            {
              "value": "1",
              "text": "January"
            },
            {
              "value": "2",
              "text": "February"
            },
            {
              "value": "3",
              "text": "March"
            },
            {
              "value": "4",
              "text": "April"
            },
            {
              "value": "5",
              "text": "May"
            },
            {
              "value": "6",
              "text": "June"
            },
            {
              "value": "7",
              "text": "July"
            },
            {
              "value": "8",
              "text": "August"
            },
            {
              "value": "9",
              "text": "September"
            },
            {
              "value": "10",
              "text": "October"
            },
            {
              "value": "11",
              "text": "November"
            },
            {
              "value": "12",
              "text": "December"
            }
          ]
        },
        {
          "id": "input_18_day",
          "label": "Day",
          "type": "select",
          "required": true,
          "options": [
            {
              "value": "",
              "text": "Please select a day"
            },
            {
              "value": "1",
              "text": "1"
            },
            {
              "value": "2",
              "text": "2"
            },
            {
              "value": "3",
              "text": "3"
            },
            {
              "value": "4",
              "text": "4"
            },
            {
              "value": "5",
              "text": "5"
            },
            {
              "value": "6",
              "text": "6"
            },
            {
              "value": "7",
              "text": "7"
            },
            {
              "value": "8",
              "text": "8"
            },
            {
              "value": "9",
              "text": "9"
            },
            {
              "value": "10",
              "text": "10"
            },
            {
              "value": "11",
              "text": "11"
            },
            {
              "value": "12",
              "text": "12"
            },
            {
              "value": "13",
              "text": "13"
            },
            {
              "value": "14",
              "text": "14"
            },
            {
              "value": "15",
              "text": "15"
            },
            {
              "value": "16",
              "text": "16"
            },
            {
              "value": "17",
              "text": "17"
            },
            {
              "value": "18",
              "text": "18"
            },
            {
              "value": "19",
              "text": "19"
            },
            {
              "value": "20",
              "text": "20"
            },
            {
              "value": "21",
              "text": "21"
            },
            {
              "value": "22",
              "text": "22"
            },
            {
              "value": "23",
              "text": "23"
            },
            {
              "value": "24",
              "text": "24"
            },
            {
              "value": "25",
              "text": "25"
            },
            {
              "value": "26",
              "text": "26"
            },
            {
              "value": "27",
              "text": "27"
            },
            {
              "value": "28",
              "text": "28"
            },
            {
              "value": "29",
              "text": "29"
            },
            {
              "value": "30",
              "text": "30"
            },
            {
              "value": "31",
              "text": "31"
            }
          ]
        },
        {
          "id": "input_18_year",
          "label": "Year",
          "type": "select",
          "required": true,
          "options": [
            {
              "value": "",
              "text": "Please select a year"
            },
            {
              "value": "2026",
              "text": "2026"
            },
            {
              "value": "2025",
              "text": "2025"
            },
            {
              "value": "2024",
              "text": "2024"
            },
            {
              "value": "2023",
              "text": "2023"
            },
            {
              "value": "2022",
              "text": "2022"
            },
            {
              "value": "2021",
              "text": "2021"
            },
            {
              "value": "2020",
              "text": "2020"
            },
            {
              "value": "2019",
              "text": "2019"
            },
            {
              "value": "2018",
              "text": "2018"
            },
            {
              "value": "2017",
              "text": "2017"
            },
            {
              "value": "2016",
              "text": "2016"
            },
            {
              "value": "2015",
              "text": "2015"
            },
            {
              "value": "2014",
              "text": "2014"
            },
            {
              "value": "2013",
              "text": "2013"
            },
            {
              "value": "2012",
              "text": "2012"
            },
            {
              "value": "2011",
              "text": "2011"
            },
            {
              "value": "2010",
              "text": "2010"
            },
            {
              "value": "2009",
              "text": "2009"
            },
            {
              "value": "2008",
              "text": "2008"
            },
            {
              "value": "2007",
              "text": "2007"
            },
            {
              "value": "2006",
              "text": "2006"
            },
            {
              "value": "2005",
              "text": "2005"
            },
            {
              "value": "2004",
              "text": "2004"
            },
            {
              "value": "2003",
              "text": "2003"
            },
            {
              "value": "2002",
              "text": "2002"
            },
            {
              "value": "2001",
              "text": "2001"
            },
            {
              "value": "2000",
              "text": "2000"
            },
            {
              "value": "1999",
              "text": "1999"
            },
            {
              "value": "1998",
              "text": "1998"
            },
            {
              "value": "1997",
              "text": "1997"
            },
            {
              "value": "1996",
              "text": "1996"
            },
            {
              "value": "1995",
              "text": "1995"
            },
            {
              "value": "1994",
              "text": "1994"
            },
            {
              "value": "1993",
              "text": "1993"
            },
            {
              "value": "1992",
              "text": "1992"
            },
            {
              "value": "1991",
              "text": "1991"
            },
            {
              "value": "1990",
              "text": "1990"
            },
            {
              "value": "1989",
              "text": "1989"
            },
            {
              "value": "1988",
              "text": "1988"
            },
            {
              "value": "1987",
              "text": "1987"
            },
            {
              "value": "1986",
              "text": "1986"
            },
            {
              "value": "1985",
              "text": "1985"
            },
            {
              "value": "1984",
              "text": "1984"
            },
            {
              "value": "1983",
              "text": "1983"
            },
            {
              "value": "1982",
              "text": "1982"
            },
            {
              "value": "1981",
              "text": "1981"
            },
            {
              "value": "1980",
              "text": "1980"
            },
            {
              "value": "1979",
              "text": "1979"
            },
            {
              "value": "1978",
              "text": "1978"
            },
            {
              "value": "1977",
              "text": "1977"
            },
            {
              "value": "1976",
              "text": "1976"
            },
            {
              "value": "1975",
              "text": "1975"
            },
            {
              "value": "1974",
              "text": "1974"
            },
            {
              "value": "1973",
              "text": "1973"
            },
            {
              "value": "1972",
              "text": "1972"
            },
            {
              "value": "1971",
              "text": "1971"
            },
            {
              "value": "1970",
              "text": "1970"
            },
            {
              "value": "1969",
              "text": "1969"
            },
            {
              "value": "1968",
              "text": "1968"
            },
            {
              "value": "1967",
              "text": "1967"
            },
            {
              "value": "1966",
              "text": "1966"
            },
            {
              "value": "1965",
              "text": "1965"
            },
            {
              "value": "1964",
              "text": "1964"
            },
            {
              "value": "1963",
              "text": "1963"
            },
            {
              "value": "1962",
              "text": "1962"
            },
            {
              "value": "1961",
              "text": "1961"
            },
            {
              "value": "1960",
              "text": "1960"
            },
            {
              "value": "1959",
              "text": "1959"
            },
            {
              "value": "1958",
              "text": "1958"
            },
            {
              "value": "1957",
              "text": "1957"
            },
            {
              "value": "1956",
              "text": "1956"
            },
            {
              "value": "1955",
              "text": "1955"
            },
            {
              "value": "1954",
              "text": "1954"
            },
            {
              "value": "1953",
              "text": "1953"
            },
            {
              "value": "1952",
              "text": "1952"
            },
            {
              "value": "1951",
              "text": "1951"
            },
            {
              "value": "1950",
              "text": "1950"
            },
            {
              "value": "1949",
              "text": "1949"
            },
            {
              "value": "1948",
              "text": "1948"
            },
            {
              "value": "1947",
              "text": "1947"
            },
            {
              "value": "1946",
              "text": "1946"
            },
            {
              "value": "1945",
              "text": "1945"
            },
            {
              "value": "1944",
              "text": "1944"
            },
            {
              "value": "1943",
              "text": "1943"
            },
            {
              "value": "1942",
              "text": "1942"
            },
            {
              "value": "1941",
              "text": "1941"
            },
            {
              "value": "1940",
              "text": "1940"
            },
            {
              "value": "1939",
              "text": "1939"
            },
            {
              "value": "1938",
              "text": "1938"
            },
            {
              "value": "1937",
              "text": "1937"
            },
            {
              "value": "1936",
              "text": "1936"
            },
            {
              "value": "1935",
              "text": "1935"
            },
            {
              "value": "1934",
              "text": "1934"
            },
            {
              "value": "1933",
              "text": "1933"
            },
            {
              "value": "1932",
              "text": "1932"
            },
            {
              "value": "1931",
              "text": "1931"
            },
            {
              "value": "1930",
              "text": "1930"
            },
            {
              "value": "1929",
              "text": "1929"
            },
            {
              "value": "1928",
              "text": "1928"
            },
            {
              "value": "1927",
              "text": "1927"
            },
            {
              "value": "1926",
              "text": "1926"
            },
            {
              "value": "1925",
              "text": "1925"
            },
            {
              "value": "1924",
              "text": "1924"
            },
            {
              "value": "1923",
              "text": "1923"
            },
            {
              "value": "1922",
              "text": "1922"
            },
            {
              "value": "1921",
              "text": "1921"
            },
            {
              "value": "1920",
              "text": "1920"
            }
          ]
        }
      ]
    },
    {
      "id": "id_27",
      "order": 6,
      "page": 1,
      "label": "Marital Status*",
      "type": "dropdown",
      "required": true,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_27",
          "label": "Marital Status*",
          "type": "select",
          "required": true,
          "options": [
            {
              "value": "",
              "text": "Please Select"
            },
            {
              "value": "Single",
              "text": "Single"
            },
            {
              "value": "Married",
              "text": "Married"
            }
          ]
        }
      ]
    },
    {
      "id": "id_29",
      "order": 7,
      "page": 1,
      "label": "Spouse's Name",
      "type": "fullname",
      "required": false,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [
        "First Name",
        "Middle Name",
        "Last Name"
      ],
      "controls": [
        {
          "id": "first_29",
          "label": "First Name",
          "type": "text",
          "required": false
        },
        {
          "id": "middle_29",
          "label": "Middle Name",
          "type": "text",
          "required": false
        },
        {
          "id": "last_29",
          "label": "Last Name",
          "type": "text",
          "required": false
        }
      ]
    },
    {
      "id": "id_26",
      "order": 8,
      "page": 1,
      "label": "Anniversary",
      "type": "datetime",
      "required": false,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [
        "Month",
        "Day",
        "Year",
        "2 digit month, 2 digit day, 4 digit year",
        "Date"
      ],
      "controls": [
        {
          "id": "id_26_date",
          "label": "Date",
          "type": "date",
          "required": false,
          "defaultToday": false
        }
      ]
    },
    {
      "id": "id_23",
      "order": 9,
      "page": 1,
      "label": "Area(s) of Interest - Select up to three options.*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "GENERAL (operational preference); RESTRICTED when linked to an applicant",
      "help": [],
      "controls": [
        {
          "id": "input_23_0",
          "label": "CHILDREN'S* Please choose specific class(es) in next section.",
          "type": "checkbox",
          "required": true,
          "value": "CHILDREN'S* Please choose specific class(es) in next section."
        },
        {
          "id": "input_23_1",
          "label": "YOUTH",
          "type": "checkbox",
          "required": true,
          "value": "YOUTH"
        },
        {
          "id": "input_23_2",
          "label": "MUSIC (WORSHIP/BAND)",
          "type": "checkbox",
          "required": true,
          "value": "MUSIC (WORSHIP/BAND)"
        },
        {
          "id": "input_23_3",
          "label": "SOUND",
          "type": "checkbox",
          "required": true,
          "value": "SOUND"
        },
        {
          "id": "input_23_4",
          "label": "MEDIA/TECH",
          "type": "checkbox",
          "required": true,
          "value": "MEDIA/TECH"
        },
        {
          "id": "input_23_5",
          "label": "USHER",
          "type": "checkbox",
          "required": true,
          "value": "USHER"
        },
        {
          "id": "input_23_6",
          "label": "GREETER",
          "type": "checkbox",
          "required": true,
          "value": "GREETER"
        },
        {
          "id": "input_23_7",
          "label": "CAFE",
          "type": "checkbox",
          "required": true,
          "value": "CAFE"
        },
        {
          "id": "input_23_8",
          "label": "PARKING LOT TEAM",
          "type": "checkbox",
          "required": true,
          "value": "PARKING LOT TEAM"
        },
        {
          "id": "input_23_9",
          "label": "MERCH STORE",
          "type": "checkbox",
          "required": true,
          "value": "MERCH STORE"
        },
        {
          "id": "input_23_10",
          "label": "WELCOME DESK",
          "type": "checkbox",
          "required": true,
          "value": "WELCOME DESK"
        },
        {
          "id": "input_23_11",
          "label": "INTERPRETER",
          "type": "checkbox",
          "required": true,
          "value": "INTERPRETER"
        },
        {
          "id": "input_23_12",
          "label": "HOSPITALITY",
          "type": "checkbox",
          "required": true,
          "value": "HOSPITALITY"
        },
        {
          "id": "input_23_13",
          "label": "BUILDING MAINTENANCE",
          "type": "checkbox",
          "required": true,
          "value": "BUILDING MAINTENANCE"
        },
        {
          "id": "input_23_14",
          "label": "AUTO MAINTENANCE",
          "type": "checkbox",
          "required": true,
          "value": "AUTO MAINTENANCE"
        }
      ]
    },
    {
      "id": "id_81",
      "order": 10,
      "page": 1,
      "label": "*Children's Classes (Select all that apply)*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "GENERAL (operational preference); RESTRICTED when linked to an applicant",
      "help": [],
      "controls": [
        {
          "id": "input_81_0",
          "label": "N/A",
          "type": "checkbox",
          "required": true,
          "value": "N/A"
        },
        {
          "id": "input_81_1",
          "label": "NURSERY (6MO-WALKING)",
          "type": "checkbox",
          "required": true,
          "value": "NURSERY (6MO-WALKING)"
        },
        {
          "id": "input_81_2",
          "label": "TODDLERS (1 TO 2YRS)",
          "type": "checkbox",
          "required": true,
          "value": "TODDLERS (1 TO 2YRS)"
        },
        {
          "id": "input_81_3",
          "label": "EARLY ELEMENTARY (3YRS TO KINDERGARTEN)",
          "type": "checkbox",
          "required": true,
          "value": "EARLY ELEMENTARY (3YRS TO KINDERGARTEN)"
        },
        {
          "id": "input_81_4",
          "label": "UPPER ELEMENTARY (1ST-5TH)",
          "type": "checkbox",
          "required": true,
          "value": "UPPER ELEMENTARY (1ST-5TH)"
        },
        {
          "id": "input_81_5",
          "label": "TEACHER",
          "type": "checkbox",
          "required": true,
          "value": "TEACHER"
        },
        {
          "id": "input_81_6",
          "label": "ASSISTANT",
          "type": "checkbox",
          "required": true,
          "value": "ASSISTANT"
        }
      ]
    },
    {
      "id": "id_25",
      "order": 11,
      "page": 1,
      "label": "Other Area(s) of Interest Not Listed Above",
      "type": "textbox",
      "required": false,
      "hidden": false,
      "sensitivity": "GENERAL (operational preference); RESTRICTED when linked to an applicant",
      "help": [],
      "controls": [
        {
          "id": "input_25",
          "label": "Other Area(s) of Interest Not Listed Above",
          "type": "text",
          "required": false
        }
      ]
    },
    {
      "id": "id_15",
      "order": 12,
      "page": 1,
      "label": "Available Start Date*",
      "type": "datetime",
      "required": true,
      "hidden": false,
      "sensitivity": "GENERAL (operational preference); RESTRICTED when linked to an applicant",
      "help": [
        "Month",
        "Day",
        "Year",
        "2 digit month, 2 digit day, 4 digit year",
        "Date"
      ],
      "controls": [
        {
          "id": "id_15_date",
          "label": "Date",
          "type": "date",
          "required": true,
          "defaultToday": true
        }
      ]
    },
    {
      "id": "id_22",
      "order": 13,
      "page": 1,
      "label": "Experience Related to Area(s) of Interest*",
      "type": "textarea",
      "required": true,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_22",
          "label": "Experience Related to Area(s) of Interest*",
          "type": "textarea",
          "required": true,
          "placeholder": "Type here..."
        }
      ]
    },
    {
      "id": "id_32",
      "order": 14,
      "page": 2,
      "label": "Do you currently use or consume any of the following? Select all that apply.*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_32_0",
          "label": "TOBACCO",
          "type": "checkbox",
          "required": true,
          "value": "TOBACCO"
        },
        {
          "id": "input_32_1",
          "label": "E-CIGARETTES",
          "type": "checkbox",
          "required": true,
          "value": "E-CIGARETTES"
        },
        {
          "id": "input_32_2",
          "label": "ALCOHOL",
          "type": "checkbox",
          "required": true,
          "value": "ALCOHOL"
        },
        {
          "id": "input_32_3",
          "label": "ILLEGAL DRUGS",
          "type": "checkbox",
          "required": true,
          "value": "ILLEGAL DRUGS"
        },
        {
          "id": "input_32_4",
          "label": "NONE",
          "type": "checkbox",
          "required": true,
          "value": "NONE"
        }
      ]
    },
    {
      "id": "id_34",
      "order": 15,
      "page": 2,
      "label": "Have you used or consumed any of the following in the past? Select all that apply.*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_34_0",
          "label": "TOBACCO",
          "type": "checkbox",
          "required": true,
          "value": "TOBACCO"
        },
        {
          "id": "input_34_1",
          "label": "E-CIGARETTES",
          "type": "checkbox",
          "required": true,
          "value": "E-CIGARETTES"
        },
        {
          "id": "input_34_2",
          "label": "ALCOHOL",
          "type": "checkbox",
          "required": true,
          "value": "ALCOHOL"
        },
        {
          "id": "input_34_3",
          "label": "ILLEGAL DRUGS",
          "type": "checkbox",
          "required": true,
          "value": "ILLEGAL DRUGS"
        },
        {
          "id": "input_34_4",
          "label": "NONE",
          "type": "checkbox",
          "required": true,
          "value": "NONE"
        }
      ]
    },
    {
      "id": "id_93",
      "order": 16,
      "page": 2,
      "label": "Please explain how long ago you quit for each item or type N/A if you selected None.*",
      "type": "textarea",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_93",
          "label": "Please explain how long ago you quit for each item or type N/A if you selected None.*",
          "type": "textarea",
          "required": true
        }
      ]
    },
    {
      "id": "id_33",
      "order": 17,
      "page": 2,
      "label": "Please explain how long ago you quit for each item or type N/A if you selected None.*",
      "type": "textbox",
      "required": true,
      "hidden": true,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_33",
          "label": "Please explain how long ago you quit for each item or type N/A if you selected None.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_82",
      "order": 18,
      "page": 2,
      "label": "Have you ever been prescribed and/or taken any Psychiatric drugs/medications other than anti-depressants/anxiety medications?*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_82_0",
          "label": "YES",
          "type": "checkbox",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_82_1",
          "label": "NO",
          "type": "checkbox",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_83",
      "order": 19,
      "page": 2,
      "label": "Have you ever been a patient (committed or voluntarily) in a mental health facility?*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_83_0",
          "label": "YES",
          "type": "checkbox",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_83_1",
          "label": "NO",
          "type": "checkbox",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_36",
      "order": 20,
      "page": 2,
      "label": "Do you currently view Pornography?*",
      "type": "radio",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_36_0",
          "label": "YES",
          "type": "radio",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_36_1",
          "label": "NO",
          "type": "radio",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_38",
      "order": 21,
      "page": 2,
      "label": "Have you viewed Pornography in the past?*",
      "type": "radio",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_38_0",
          "label": "YES",
          "type": "radio",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_38_1",
          "label": "NO",
          "type": "radio",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_37",
      "order": 22,
      "page": 2,
      "label": "If YES, please explain how long ago you stopped or type N/A if you answered NO.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_37",
          "label": "If YES, please explain how long ago you stopped or type N/A if you answered NO.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_39",
      "order": 23,
      "page": 2,
      "label": "Do you currently engage in Homosexuality or any other lifestyle within the definition of LGBTQ+?*",
      "type": "radio",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_39_0",
          "label": "YES",
          "type": "radio",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_39_1",
          "label": "NO",
          "type": "radio",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_40",
      "order": 24,
      "page": 2,
      "label": "Have you engaged in Homosexuality or any other lifestyle within the definition of LGBTQ+ in the past?*",
      "type": "radio",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_40_0",
          "label": "YES",
          "type": "radio",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_40_1",
          "label": "NO",
          "type": "radio",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_41",
      "order": 25,
      "page": 2,
      "label": "If YES, please explain how long ago it was or type N/A if you answered NO.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_41",
          "label": "If YES, please explain how long ago it was or type N/A if you answered NO.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_43",
      "order": 26,
      "page": 2,
      "label": "Have you ever been accused of and/or convicted of spousal abuse?*",
      "type": "radio",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_43_0",
          "label": "YES",
          "type": "radio",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_43_1",
          "label": "NO",
          "type": "radio",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_45",
      "order": 27,
      "page": 2,
      "label": "If YES, please explain or type N/A if you answered NO.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_45",
          "label": "If YES, please explain or type N/A if you answered NO.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_42",
      "order": 28,
      "page": 2,
      "label": "Have you ever been accused of and/or convicted of child abuse or any crime involving actual or attempted sexual molestation of a minor?*",
      "type": "radio",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_42_0",
          "label": "YES",
          "type": "radio",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_42_1",
          "label": "NO",
          "type": "radio",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_44",
      "order": 29,
      "page": 2,
      "label": "If YES, please explain or type N/A if you answered NO.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_44",
          "label": "If YES, please explain or type N/A if you answered NO.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_49",
      "order": 30,
      "page": 3,
      "label": "Do you have any physical limitations or medical conditions that would prevent you from performing certain duties or activities relating to the area of interest(s) you selected? If Yes, please explain.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_49",
          "label": "Do you have any physical limitations or medical conditions that would prevent you from performing certain duties or activities relating to the area of interest(s) you selected? If Yes, please explain.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_50",
      "order": 31,
      "page": 3,
      "label": "Do you presently have any communicable diseases, such as but not limited to, HIV, AIDS or Hepatitis? If Yes, please explain.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_50",
          "label": "Do you presently have any communicable diseases, such as but not limited to, HIV, AIDS or Hepatitis? If Yes, please explain.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_53",
      "order": 32,
      "page": 4,
      "label": "Do you currently attend services at Champion Life Church?*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_53_0",
          "label": "YES",
          "type": "checkbox",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_53_1",
          "label": "NO",
          "type": "checkbox",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_55",
      "order": 33,
      "page": 4,
      "label": "If Yes, how long have you attended? Type N/A if you answered NO.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_55",
          "label": "If Yes, how long have you attended? Type N/A if you answered NO.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_54",
      "order": 34,
      "page": 4,
      "label": "Are you Born Again?*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_54_0",
          "label": "YES",
          "type": "checkbox",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_54_1",
          "label": "NO",
          "type": "checkbox",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_56",
      "order": 35,
      "page": 4,
      "label": "If Yes, when or how long ago? Type N/A if you answered NO.*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_56",
          "label": "If Yes, when or how long ago? Type N/A if you answered NO.*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_57",
      "order": 36,
      "page": 4,
      "label": "Have you been Baptized in water since you were Born Again?*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_57_0",
          "label": "YES",
          "type": "checkbox",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_57_1",
          "label": "NO",
          "type": "checkbox",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_60",
      "order": 37,
      "page": 4,
      "label": "If Yes, when or how long ago? Type N/A if you answered NO.",
      "type": "textbox",
      "required": false,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_60",
          "label": "If Yes, when or how long ago? Type N/A if you answered NO.",
          "type": "text",
          "required": false
        }
      ]
    },
    {
      "id": "id_58",
      "order": 38,
      "page": 4,
      "label": "Have you been filled with the Holy Spirit as described in Acts 2:4?*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_58_0",
          "label": "YES",
          "type": "checkbox",
          "required": true,
          "value": "YES"
        },
        {
          "id": "input_58_1",
          "label": "NO",
          "type": "checkbox",
          "required": true,
          "value": "NO"
        }
      ]
    },
    {
      "id": "id_59",
      "order": 39,
      "page": 4,
      "label": "If Yes, when or how long ago? Type N/A if you answered NO.",
      "type": "textbox",
      "required": false,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_59",
          "label": "If Yes, when or how long ago? Type N/A if you answered NO.",
          "type": "text",
          "required": false
        }
      ]
    },
    {
      "id": "id_61",
      "order": 40,
      "page": 4,
      "label": "Do you believe in the following? Select all that apply.*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_61_0",
          "label": "In the Virgin Birth and Deity of our Lord Jesus Christ.",
          "type": "checkbox",
          "required": true,
          "value": "In the Virgin Birth and Deity of our Lord Jesus Christ."
        },
        {
          "id": "input_61_1",
          "label": "That Jesus is God's Son and only Sacrifice for the remission of sin.",
          "type": "checkbox",
          "required": true,
          "value": "That Jesus is God's Son and only Sacrifice for the remission of sin."
        },
        {
          "id": "input_61_2",
          "label": "That a man must be born again to receive eternal life.",
          "type": "checkbox",
          "required": true,
          "value": "That a man must be born again to receive eternal life."
        },
        {
          "id": "input_61_3",
          "label": "In eternal reward for the believer. (Heaven)",
          "type": "checkbox",
          "required": true,
          "value": "In eternal reward for the believer. (Heaven)"
        },
        {
          "id": "input_61_4",
          "label": "In eternal damnation for the lost. (Hell)",
          "type": "checkbox",
          "required": true,
          "value": "In eternal damnation for the lost. (Hell)"
        },
        {
          "id": "input_61_5",
          "label": "In the infallibility of the Scriptures.",
          "type": "checkbox",
          "required": true,
          "value": "In the infallibility of the Scriptures."
        },
        {
          "id": "input_61_6",
          "label": "That Jesus died on the cross for our sins.",
          "type": "checkbox",
          "required": true,
          "value": "That Jesus died on the cross for our sins."
        },
        {
          "id": "input_61_7",
          "label": "That Jesus rose bodily from the dead.",
          "type": "checkbox",
          "required": true,
          "value": "That Jesus rose bodily from the dead."
        }
      ]
    },
    {
      "id": "id_86",
      "order": 41,
      "page": 5,
      "label": "Name of Previous Church (type N/A if none atteneded)*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_86",
          "label": "Name of Previous Church (type N/A if none atteneded)*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_88",
      "order": 42,
      "page": 5,
      "label": "Name of Previous Pastor (type N/A if none)*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_88",
          "label": "Name of Previous Pastor (type N/A if none)*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_87",
      "order": 43,
      "page": 5,
      "label": "City & State of Previous Church (type N/A if none)*",
      "type": "textbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_87",
          "label": "City & State of Previous Church (type N/A if none)*",
          "type": "text",
          "required": true
        }
      ]
    },
    {
      "id": "id_89",
      "order": 44,
      "page": 5,
      "label": "Did You Serve In Your Previous Church*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_89_0",
          "label": "Yes",
          "type": "checkbox",
          "required": true,
          "value": "Yes"
        },
        {
          "id": "input_89_1",
          "label": "No",
          "type": "checkbox",
          "required": true,
          "value": "No"
        },
        {
          "id": "input_89_2",
          "label": "Not Applicable",
          "type": "checkbox",
          "required": true,
          "value": "Not Applicable"
        }
      ]
    },
    {
      "id": "id_92",
      "order": 45,
      "page": 5,
      "label": "Did you leave the church in good standing?*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_92_0",
          "label": "Yes",
          "type": "checkbox",
          "required": true,
          "value": "Yes"
        },
        {
          "id": "input_92_1",
          "label": "No",
          "type": "checkbox",
          "required": true,
          "value": "No"
        },
        {
          "id": "input_92_2",
          "label": "Maybe",
          "type": "checkbox",
          "required": true,
          "value": "Maybe"
        },
        {
          "id": "input_92_3",
          "label": "Not Applicable",
          "type": "checkbox",
          "required": true,
          "value": "Not Applicable"
        }
      ]
    },
    {
      "id": "id_91",
      "order": 46,
      "page": 5,
      "label": "What Area(s) Did You Serve In (& any additional info. Type N/A if this does not apply.)*",
      "type": "textarea",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_91",
          "label": "What Area(s) Did You Serve In (& any additional info. Type N/A if this does not apply.)*",
          "type": "textarea",
          "required": true
        }
      ]
    },
    {
      "id": "id_77",
      "order": 47,
      "page": 6,
      "label": "Only choose the levels of code of ethics you are committing to*",
      "type": "radio",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_77_0",
          "label": "I have read and agree to the General Dream Team Code of Ethics for Levels 1-2-3 Dream Team Members.",
          "type": "radio",
          "required": true,
          "value": "I have read and agree to the General Dream Team Code of Ethics for Levels 1-2-3 Dream Team Members."
        }
      ]
    },
    {
      "id": "id_95",
      "order": 48,
      "page": 6,
      "label": "",
      "type": "radio",
      "required": false,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_95_0",
          "label": "I have read and agree to the Additional Dream Team Code of Ethics for Level 2 & 3 Dream Team Members.",
          "type": "radio",
          "required": false,
          "value": "I have read and agree to the Additional Dream Team Code of Ethics for Level 2 & 3 Dream Team Members."
        }
      ]
    },
    {
      "id": "id_96",
      "order": 49,
      "page": 6,
      "label": "If you are not able to select \"I have read and agree to...\" To one or both of the above , please let us know which numbers you are not able to commit to and a brief explanation.",
      "type": "textarea",
      "required": false,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_96",
          "label": "If you are not able to select \"I have read and agree to...\" To one or both of the above , please let us know which numbers you are not able to commit to and a brief explanation.",
          "type": "textarea",
          "required": false
        }
      ]
    },
    {
      "id": "id_102",
      "order": 50,
      "page": 7,
      "label": "I have completed the following classes, either in person or online:*",
      "type": "checkbox",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": [
        {
          "id": "input_102_0",
          "label": "Growth Track (4 week series)",
          "type": "checkbox",
          "required": true,
          "value": "Growth Track (4 week series)"
        },
        {
          "id": "input_102_1",
          "label": "Dream Track (6 week series)",
          "type": "checkbox",
          "required": true,
          "value": "Dream Track (6 week series)"
        },
        {
          "id": "input_102_2",
          "label": "Get a Grip on the Basics (13 week series)",
          "type": "checkbox",
          "required": true,
          "value": "Get a Grip on the Basics (13 week series)"
        },
        {
          "id": "input_102_3",
          "label": "None of the Above",
          "type": "checkbox",
          "required": true,
          "value": "None of the Above"
        }
      ]
    },
    {
      "id": "id_71",
      "order": 51,
      "page": 8,
      "label": "Signature*",
      "type": "signature",
      "required": true,
      "hidden": false,
      "sensitivity": "HIGHLY RESTRICTED",
      "help": [],
      "controls": []
    },
    {
      "id": "id_72",
      "order": 52,
      "page": 8,
      "label": "Date*",
      "type": "datetime",
      "required": true,
      "hidden": false,
      "sensitivity": "RESTRICTED",
      "help": [
        "Month",
        "Day",
        "Year",
        "2 digit month, 2 digit day, 4 digit year",
        "Date"
      ],
      "controls": [
        {
          "id": "id_72_date",
          "label": "Date",
          "type": "date",
          "required": true,
          "defaultToday": false
        }
      ]
    }
  ]
}
$source$::jsonb);
create table private.dream_team_applications(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id), person_id uuid,
 form_version text not null references private.dream_team_forms(version), status text not null default 'available' check(status in('available','invited','started','submitted','under_review','more_info_requested','approved_for_placement','declined','withdrawn')),
 answers jsonb not null default '{}', revision integer not null default 1, available_at timestamptz not null default now(),available_reason text not null,
 invited_at timestamptz,invited_by uuid references auth.users(id),started_at timestamptz,submitted_at timestamptz,reviewer uuid references auth.users(id),review_started_at timestamptz,decision_at timestamptz,approved_at timestamptz,declined_at timestamptz,
 applicant_request text,private_note text,placement_status text not null default 'unassigned' check(placement_status in('unassigned','assigned')),updated_at timestamptz not null default now(),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),unique(organization_id,user_id),unique(organization_id,id));
create table private.dream_team_submissions(id uuid primary key default gen_random_uuid(),application_id uuid not null references private.dream_team_applications(id),version integer not null,snapshot jsonb not null,submitted_at timestamptz not null default clock_timestamp(),unique(application_id,version));
create table private.dream_team_audit(id bigint generated always as identity primary key,application_id uuid not null references private.dream_team_applications(id),actor uuid references auth.users(id),action text not null,note text,at timestamptz not null default clock_timestamp());
create table private.domain_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),person_id uuid,actor uuid references auth.users(id),event_type text not null,source_id uuid,correlation text not null unique,occurred_at timestamptz not null default clock_timestamp(),foreign key(organization_id,person_id) references public.organization_people(organization_id,id));
create index domain_events_org_time on private.domain_events(organization_id,occurred_at desc);
create table private.dream_team_jobs(id uuid primary key default gen_random_uuid(),application_id uuid not null references private.dream_team_applications(id),kind text not null check(kind in('online_email','invite_email','pdf')),submission_id uuid references private.dream_team_submissions(id),dedup text not null unique,status text not null default 'queued' check(status in('queued','processing','accepted','failed','unknown')),lease uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index dream_team_jobs_queue on private.dream_team_jobs(status,created_at);
create table private.protected_documents(id uuid primary key default gen_random_uuid(),application_id uuid not null references private.dream_team_applications(id),submission_id uuid not null unique references private.dream_team_submissions(id),object_path text not null unique,sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now());
create table private.dream_team_placements(id uuid primary key default gen_random_uuid(),application_id uuid not null references private.dream_team_applications(id),department_id uuid not null,team text not null,role_title text not null default '',leader_person_id uuid,effective_at timestamptz not null,note text not null default '',created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create function private.dream_team_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Immutable Dream Team history';end$$;
create trigger dream_team_submission_immutable before update or delete on private.dream_team_submissions for each row execute function private.dream_team_immutable();
create trigger dream_team_audit_immutable before update or delete on private.dream_team_audit for each row execute function private.dream_team_immutable();
create trigger domain_events_immutable before update or delete on private.domain_events for each row execute function private.dream_team_immutable();
create trigger dream_team_form_immutable before update or delete on private.dream_team_forms for each row execute function private.dream_team_immutable();
create trigger protected_documents_immutable before update or delete on private.protected_documents for each row execute function private.dream_team_immutable();
create trigger dream_team_placements_immutable before update or delete on private.dream_team_placements for each row execute function private.dream_team_immutable();

create function private.dream_team_event(a private.dream_team_applications,kind text,key text) returns void language sql set search_path='' as $$
 insert into private.domain_events(organization_id,person_id,actor,event_type,source_id,correlation) values(a.organization_id,a.person_id,auth.uid(),kind,a.id,key) on conflict(correlation) do nothing
$$;
create function private.dream_team_available(org uuid,usr uuid,reason text) returns private.dream_team_applications language plpgsql set search_path='' as $$
declare a private.dream_team_applications;pid uuid;begin
 select person_id into pid from public.portal_account_links where organization_id=org and user_id=usr and active;
 insert into private.dream_team_applications(organization_id,user_id,person_id,form_version,available_reason) values(org,usr,pid,'dream-team-v1-20261002',reason) on conflict(organization_id,user_id) do nothing;
 select * into a from private.dream_team_applications where organization_id=org and user_id=usr;
 perform private.dream_team_event(a,'dream_team.application_available',a.id||':available');
 if reason='online_completed' then insert into private.dream_team_jobs(application_id,kind,dedup) values(a.id,'online_email',a.id||':online_email') on conflict do nothing;end if;
 return a;
end$$;
create function private.dream_team_course_hook() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;usr uuid;a private.dream_team_applications;begin
 select s.organization_id,e.user_id into org,usr from public.course_enrollments e join public.course_settings s on s.course_id=e.course_id join public.courses c on c.id=e.course_id where e.id=new.enrollment_id and c.slug='dream-track';
 if org is null or new.online_completed_at is null then return new;end if;
 a:=private.dream_team_available(org,usr,'online_completed');
 perform private.dream_team_event(a,'dream_track.online_completed',a.id||':online_completed');
 if new.badge_awarded_at is not null and new.badge_revoked_at is null then perform private.dream_team_event(a,'dream_track.completed',a.id||':course_completed');end if;
 return new;
end$$;
create trigger dream_team_course_hook after insert or update on public.course_completions for each row execute function private.dream_team_course_hook();

-- Validation shares the versioned source definition used by the native renderer.
create function private.dream_team_validate(def jsonb,answers jsonb,final boolean) returns void language plpgsql set search_path='' as $$
declare f jsonb;c jsonb;v jsonb;cv jsonb;k text;stroke jsonb;pt jsonb;n integer:=0;begin
 if jsonb_typeof(answers) is distinct from 'object' or octet_length(answers::text)>250000 then raise exception 'Invalid answers';end if;
 for k in select jsonb_object_keys(answers) loop if not exists(select 1 from jsonb_array_elements(def->'fields')x where x->>'id'=k) then raise exception 'Unknown field';end if;end loop;
 for f in select * from jsonb_array_elements(def->'fields') loop
 v:=answers->(f->>'id');
 if (f->>'hidden')::boolean then if v is not null and v<>'null'::jsonb and v<>'{}'::jsonb then raise exception 'Hidden source field must remain empty';end if;continue;end if;
 if f->>'type'='signature' then
  if v is null or v='null'::jsonb then if final then raise exception 'Draw your signature';end if;continue;end if;
  if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>100 then raise exception 'Invalid signature';end if;
  for stroke in select * from jsonb_array_elements(v) loop
   if jsonb_typeof(stroke)<>'array' or jsonb_array_length(stroke)<2 or jsonb_array_length(stroke)>2000 then raise exception 'Invalid signature stroke';end if;
   for pt in select * from jsonb_array_elements(stroke) loop
    if jsonb_typeof(pt)<>'array' or jsonb_array_length(pt)<>2 or jsonb_typeof(pt->0)<>'number' or jsonb_typeof(pt->1)<>'number' or (pt->>0)::numeric not between 0 and 1 or (pt->>1)::numeric not between 0 and 1 then raise exception 'Invalid signature point';end if;n:=n+1;
   end loop;
  end loop;
  if n>10000 or (final and n<2) then raise exception 'Draw your signature';end if;continue;
 end if;
 if f->>'type' in('checkbox','radio') then
  if v is null then v:='[]';end if;
  if jsonb_typeof(v)<>'array' then raise exception 'Invalid selection';end if;
  if (final and (f->>'required')::boolean and jsonb_array_length(v)=0) or (f->>'type'='radio' and jsonb_array_length(v)>1) then raise exception 'Required selection: %',f->>'label';end if;
  if jsonb_array_length(v)<>(select count(distinct x) from jsonb_array_elements(v)x) then raise exception 'Duplicate selection';end if;
  for cv in select * from jsonb_array_elements(v) loop if not exists(select 1 from jsonb_array_elements(f->'controls')x where x->'value'=cv) then raise exception 'Invalid option';end if;end loop;
 else
  if v is null then v:='{}';end if;
  if jsonb_typeof(v)<>'object' then raise exception 'Invalid response';end if;
  for k in select jsonb_object_keys(v) loop if not exists(select 1 from jsonb_array_elements(f->'controls')x where x->>'id'=k) then raise exception 'Unknown response part';end if;end loop;
  for c in select * from jsonb_array_elements(f->'controls') loop
   cv:=v->(c->>'id');
   if cv is not null and jsonb_typeof(cv)<>'string' then raise exception 'Text response required';end if;
   k:=coalesce(v->>(c->>'id'),'');
   if length(k)>coalesce((c->>'maxLength')::integer,10000) then raise exception 'Response too long';end if;
   if final and (c->>'required')::boolean and btrim(k)='' then raise exception 'Required response: %',f->>'label';end if;
   if k<>'' and c->>'type'='select' and not exists(select 1 from jsonb_array_elements(c->'options')x where x->>'value'=k) then raise exception 'Invalid option';end if;
   if final and k<>'' and c->>'type'='email' and k!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email format';end if;
   if final and f->>'type'='phone' and k!~ '^\([0-9]{3}\) [0-9]{3}-[0-9]{4}$' then raise exception 'Phone format: (000) 000-0000';end if;
   if k<>'' and c->>'type'='date' then if k!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date';end if;perform k::date;end if;
  end loop;
  if final and f->>'type'='birthdate' then perform make_date((v->>'input_18_year')::integer,(v->>'input_18_month')::integer,(v->>'input_18_day')::integer);end if;
 end if;
 end loop;
end$$;
create function private.dream_team_summary(a private.dream_team_applications) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(a)-'answers'-'private_note'-'applicant_request'-'user_id' || jsonb_build_object('identity_ready',exists(select 1 from public.portal_account_links l where l.organization_id=a.organization_id and l.person_id=a.person_id and l.user_id=a.user_id and l.active),'email_status',(select j.status from private.dream_team_jobs j where j.application_id=a.id and j.kind in('online_email','invite_email') order by j.created_at desc limit 1),'pdf_status',(select status from private.dream_team_jobs where application_id=a.id and kind='pdf' order by created_at desc limit 1),'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'created_at',d.created_at)),'[]') from private.protected_documents d where d.application_id=a.id))
$$;
create function private.dream_team(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();a private.dream_team_applications;def jsonb;pid uuid;s private.dream_team_submissions;begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and not is_anonymous) then raise exception 'Verified sign-in required' using errcode='42501';end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>260000 then raise exception 'Request too large';end if;
 select * into a from private.dream_team_applications where user_id=uid and organization_id=(select id from public.organizations where slug='champion-life') for update;
 if a.id is null and p_action='get' and exists(select 1 from public.course_completions c join public.course_enrollments e on e.id=c.enrollment_id join public.courses cr on cr.id=e.course_id join public.course_settings cs on cs.course_id=e.course_id where e.user_id=uid and cr.slug='dream-track' and cs.organization_id=(select id from public.organizations where slug='champion-life') and c.online_completed_at is not null) then
  -- Existing completers become eligible on their own next visit; no bulk historical mail blast.
  a:=private.dream_team_available((select id from public.organizations where slug='champion-life'),uid,'online_completed');
  perform private.dream_team_event(a,'dream_track.online_completed',a.id||':online_completed');
 end if;
 if a.id is null then return jsonb_build_object('available',false);end if;
 -- Linking is only from the existing reviewed account link, never an answer/email match.
 select person_id into pid from public.portal_account_links where organization_id=a.organization_id and user_id=uid and active;
 if a.person_id is null and pid is not null then update private.dream_team_applications set person_id=pid where id=a.id returning * into a;end if;
 select definition into def from private.dream_team_forms where version=a.form_version;
 if p_action='save' then
  if a.status not in('available','invited','started') then raise exception 'This application is not editable';end if;
  if a.revision is distinct from (p_data->>'revision')::integer then raise exception 'A newer draft exists. Reload before editing.' using errcode='40001';end if;
  perform private.dream_team_validate(def,p_data->'answers',false);
  update private.dream_team_applications set answers=p_data->'answers',status='started',started_at=coalesce(started_at,now()),revision=revision+1,updated_at=now() where id=a.id returning * into a;
  perform private.dream_team_event(a,'dream_team.application_started',a.id||':started');
 elsif p_action='submit' then
  if a.submitted_at is null then
   if a.status not in('available','invited','started') or a.revision is distinct from (p_data->>'revision')::integer then raise exception 'Reload the current draft before submitting';end if;
   if pid is null or pid is distinct from a.person_id then raise exception 'Your Person/account link needs staff review before submission';end if;
   perform private.dream_team_validate(def,a.answers,true);
   insert into private.dream_team_submissions(application_id,version,snapshot) values(a.id,1,jsonb_build_object('form',def,'answers',a.answers,'signed_at',clock_timestamp(),'submitted_at',clock_timestamp(),'applicant_user_id',uid,'person_id',pid,'ethics_version',def->>'ethicsVersion')) returning * into s;
   update private.dream_team_applications set status='submitted',submitted_at=s.submitted_at,revision=revision+1,updated_at=now() where id=a.id returning * into a;
   insert into private.dream_team_jobs(application_id,kind,submission_id,dedup) values(a.id,'pdf',s.id,s.id||':pdf');
   insert into private.dream_team_audit(application_id,actor,action) values(a.id,uid,'submitted');
   perform private.dream_team_event(a,'dream_team.application_submitted',a.id||':submitted');
  end if;
 elsif p_action='respond' then
  if a.status<>'more_info_requested' or a.revision is distinct from (p_data->>'revision')::integer or coalesce(length(btrim(p_data->>'response')),0) not between 1 and 10000 then raise exception 'A current information request and response are required';end if;
  insert into private.dream_team_submissions(application_id,version,snapshot) values(a.id,a.revision,jsonb_build_object('form_version',a.form_version,'request',a.applicant_request,'response',p_data->>'response','submitted_at',clock_timestamp(),'applicant_user_id',uid));
  update private.dream_team_applications set status='submitted',revision=revision+1,updated_at=now() where id=a.id returning * into a;
  perform private.dream_team_event(a,'dream_team.application_submitted',a.id||':response:'||a.revision);
 elsif p_action='withdraw' then
  if a.status in('approved_for_placement','declined','withdrawn') then raise exception 'Withdrawal unavailable';end if;
  update private.dream_team_applications set status='withdrawn',revision=revision+1,updated_at=now() where id=a.id returning * into a;
  insert into private.dream_team_audit(application_id,actor,action) values(a.id,uid,'withdrawn');
 elsif p_action<>'get' then raise exception 'Unknown action';end if;
 return jsonb_build_object('available',true,'application',private.dream_team_summary(a),'form',def,'answers',a.answers,'request',a.applicant_request,'submissions',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'snapshot',snapshot-'applicant_user_id'-'person_id') order by version),'[]') from private.dream_team_submissions where application_id=a.id));
end$$;
create function public.dream_team(p_action text,p_data jsonb default '{}') returns jsonb language sql set search_path='' as $$select private.dream_team(p_action,p_data)$$;
create function private.dream_team_admin(p_org uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.dream_team_applications;uid uuid:=auth.uid();pid uuid;usr uuid;dep uuid;lead uuid;target text;result jsonb;begin
 if uid is null or not private.has_staff_permission(p_org,'dream_team.application.read') then raise exception 'Dream Team access denied' using errcode='42501';end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>20000 then raise exception 'Request too large';end if;
 if p_action='list' then
  return jsonb_build_object('applications',(select coalesce(jsonb_agg(private.dream_team_summary(x)||jsonb_build_object('name',(select concat_ws(' ',p.first_name,p.last_name) from public.organization_people p where p.id=x.person_id))),'[]') from(select * from private.dream_team_applications where organization_id=p_org and (coalesce(p_data->>'status','')='' or status=p_data->>'status') and (coalesce(p_data->>'placement','')='' or placement_status=p_data->>'placement') and (coalesce(p_data->>'search','')='' or person_id in(select id from public.organization_people where organization_id=p_org and concat_ws(' ',first_name,last_name) ilike '%'||left(p_data->>'search',100)||'%')) order by updated_at desc,id limit 50 offset greatest(0,coalesce((p_data->>'offset')::integer,0)))x),
  'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.organization_departments where organization_id=p_org and active));
 end if;
 if p_action='enable' then
  if not private.has_staff_permission(p_org,'dream_team.application.manage') or not private.person_permission(p_org,(p_data->>'person_id')::uuid,'people.read') then raise exception 'Application management denied' using errcode='42501';end if;
  select person_id,user_id into pid,usr from public.portal_account_links where organization_id=p_org and person_id=(p_data->>'person_id')::uuid and active;
  if usr is null then raise exception 'A reviewed active Person/account link is required';end if;
  a:=private.dream_team_available(p_org,usr,'admin_enabled');
  if a.person_id is null then update private.dream_team_applications set person_id=pid where id=a.id returning * into a;end if;
  if a.person_id is distinct from pid then raise exception 'Existing application identity requires review';end if;
  insert into private.dream_team_audit(application_id,actor,action,note) values(a.id,uid,'enabled',left(p_data->>'reason',500));
  return private.dream_team_summary(a);
 end if;
 select * into a from private.dream_team_applications where organization_id=p_org and id=(p_data->>'id')::uuid for update;
 if a.id is null then raise exception 'Application unavailable';end if;
 if p_action='send' then
  if not private.has_staff_permission(p_org,'dream_team.application.manage') or not private.has_staff_permission(p_org,'communications.send') then raise exception 'Invitation permission required' using errcode='42501';end if;
  if not exists(select 1 from public.portal_account_links where organization_id=p_org and person_id=a.person_id and user_id=a.user_id and active) then raise exception 'Reviewed identity link required';end if;
  if a.invited_at>now()-interval '2 minutes' then raise exception 'Wait two minutes before resending';end if;
  if a.status not in('available','invited','started','more_info_requested') then raise exception 'Invitation unavailable for this state';end if;
  update private.dream_team_applications set status=case when status='available' then 'invited' else status end,invited_at=now(),invited_by=uid,revision=revision+1,updated_at=now() where id=a.id returning * into a;
  insert into private.dream_team_jobs(application_id,kind,dedup) values(a.id,'invite_email',a.id||':invite:'||a.revision);
  insert into private.dream_team_audit(application_id,actor,action,note) values(a.id,uid,'invited',left(p_data->>'reason',500));
  perform private.dream_team_event(a,'dream_team.application_invited',a.id||':invite:'||a.revision);
 elsif p_action='detail' then
  if not private.has_staff_permission(p_org,'dream_team.application.restricted') then raise exception 'Restricted reviewer permission required' using errcode='42501';end if;
  insert into private.dream_team_audit(application_id,actor,action) values(a.id,uid,'restricted_access');
  return private.dream_team_summary(a)||jsonb_build_object('dream_track',(select jsonb_build_object('online_completed_at',c.online_completed_at,'meeting_completed_at',c.meeting_completed_at,'badge_awarded_at',case when c.badge_revoked_at is null then c.badge_awarded_at end) from public.course_completions c join public.course_enrollments e on e.id=c.enrollment_id where e.user_id=a.user_id and e.course_id=(select id from public.courses where slug='dream-track') limit 1),'submissions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.version),'[]') from private.dream_team_submissions s where s.application_id=a.id),'private_note',a.private_note,'request',a.applicant_request,'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.id desc),'[]') from(select * from private.dream_team_audit where application_id=a.id order by id desc limit 100)h),'placements',(select coalesce(jsonb_agg(to_jsonb(p) order by created_at desc),'[]') from private.dream_team_placements p where application_id=a.id));
 elsif p_action='review' then
  if not private.has_staff_permission(p_org,'dream_team.application.manage') or not private.has_staff_permission(p_org,'dream_team.application.restricted') then raise exception 'Restricted review management required' using errcode='42501';end if;
  if uid=a.user_id then raise exception 'You cannot review your own application';end if;
  if a.revision is distinct from (p_data->>'revision')::integer then raise exception 'Review changed. Reload.' using errcode='40001';end if;
  target:=p_data->>'status';
  if a.status not in('submitted','under_review') or target not in('under_review','more_info_requested','approved_for_placement','declined') then raise exception 'Invalid review transition';end if;
  if target='more_info_requested' and coalesce(length(btrim(p_data->>'request')),0) not between 1 and 3000 then raise exception 'Applicant-facing request is required';end if;
  update private.dream_team_applications set status=target,reviewer=uid,review_started_at=coalesce(review_started_at,now()),private_note=left(p_data->>'note',5000),applicant_request=case when target='more_info_requested' then p_data->>'request' else applicant_request end,
   decision_at=case when target in('approved_for_placement','declined') then now() else decision_at end,approved_at=case when target='approved_for_placement' then now() else approved_at end,declined_at=case when target='declined' then now() else declined_at end,revision=revision+1,updated_at=now() where id=a.id returning * into a;
  insert into private.dream_team_audit(application_id,actor,action,note) values(a.id,uid,target,left(p_data->>'note',5000));
  if target<>'under_review' then perform private.dream_team_event(a,'dream_team.application_'||case target when 'approved_for_placement' then 'approved' else target end,a.id||':review:'||a.revision);end if;
 elsif p_action='place' then
  if not private.has_staff_permission(p_org,'dream_team.placement.manage') then raise exception 'Placement permission required' using errcode='42501';end if;
  if a.status<>'approved_for_placement' or a.revision is distinct from (p_data->>'revision')::integer then raise exception 'Current approved application required';end if;
  dep:=(p_data->>'department_id')::uuid;lead:=nullif(p_data->>'leader_person_id','')::uuid;
  if not exists(select 1 from public.organization_departments where organization_id=p_org and id=dep and active) or not exists(select 1 from public.portal_account_links where organization_id=p_org and person_id=a.person_id and user_id=a.user_id and active) then raise exception 'Active ministry and reviewed Person required';end if;
  if lead is not null and not exists(select 1 from public.organization_people where organization_id=p_org and id=lead) then raise exception 'Leader outside organization';end if;
  if coalesce(length(btrim(p_data->>'team')),0) not between 1 and 100 then raise exception 'Team required';end if;
  insert into private.dream_team_placements(application_id,department_id,team,role_title,leader_person_id,effective_at,note,created_by) values(a.id,dep,p_data->>'team',left(coalesce(p_data->>'role_title',''),100),lead,coalesce((p_data->>'effective_at')::timestamptz,now()),left(coalesce(p_data->>'note',''),500),uid);
  insert into public.person_department_affiliations(organization_id,person_id,department_id,effective_at) values(p_org,a.person_id,dep,coalesce((p_data->>'effective_at')::timestamptz,now())) on conflict(organization_id,person_id,department_id) do update set active=true,effective_at=excluded.effective_at,expires_at=null;
  update private.dream_team_applications set placement_status='assigned',revision=revision+1,updated_at=now() where id=a.id returning * into a;
  insert into private.dream_team_audit(application_id,actor,action) values(a.id,uid,'assigned');
  perform private.dream_team_event(a,'dream_team.assignment_completed',a.id||':assigned:'||a.revision);
 else raise exception 'Unknown action';end if;
 return private.dream_team_summary(a);
end$$;
create function public.dream_team_admin(p_org uuid,p_action text,p_data jsonb default '{}') returns jsonb language sql set search_path='' as $$select private.dream_team_admin(p_org,p_action,p_data)$$;

-- Safe Person summary and milestones: no responses, notes, signature or document contents.
create function private.dream_team_person(p_org uuid,p_person uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not private.person_permission(p_org,p_person,'people.read') then raise exception 'Person access denied' using errcode='42501';end if;
 select jsonb_build_object('application',(select jsonb_build_object('id',a.id,'status',a.status,'available_at',a.available_at,'invited_at',a.invited_at,'submitted_at',a.submitted_at,'decision_at',a.decision_at,'placement_status',a.placement_status) from private.dream_team_applications a where a.organization_id=p_org and a.person_id=p_person),
 'dream_track',(select jsonb_build_object('online_completed_at',c.online_completed_at,'meeting_completed_at',c.meeting_completed_at,'badge_awarded_at',case when c.badge_revoked_at is null then c.badge_awarded_at end) from public.course_completions c join public.course_enrollments e on e.id=c.enrollment_id join public.course_settings s on s.course_id=e.course_id join public.portal_account_links l on l.user_id=e.user_id and l.organization_id=s.organization_id and l.active where s.organization_id=p_org and l.person_id=p_person and e.course_id=(select id from public.courses where slug='dream-track') limit 1),
 'timeline',(select coalesce(jsonb_agg(jsonb_build_object('type',event_type,'at',occurred_at) order by occurred_at desc),'[]') from private.domain_events where organization_id=p_org and person_id=p_person)) into result;return result;
end$$;
create function public.dream_team_person(p_org uuid,p_person uuid) returns jsonb language sql set search_path='' as $$select private.dream_team_person(p_org,p_person)$$;
create function private.dream_team_alerts(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by occurred_at desc),'[]') from(select id,event_type,source_id,person_id,occurred_at from private.domain_events where organization_id=p_org and ((event_type='dream_track.online_completed' and private.has_staff_permission(p_org,'courses.manage')) or (event_type='dream_team.application_submitted' and private.has_staff_permission(p_org,'dream_team.application.read') and private.has_staff_permission(p_org,'dream_team.application.restricted')) or (event_type='dream_team.application_approved' and private.has_staff_permission(p_org,'dream_team.placement.manage'))) order by occurred_at desc limit 100)x
$$;
create function public.dream_team_alerts(p_org uuid) returns jsonb language sql set search_path='' as $$select private.dream_team_alerts(p_org)$$;

-- Access is rechecked before each document operation. Returned paths are private and never public URLs.
create function private.dream_team_document(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.protected_documents;a private.dream_team_applications;begin
 select * into d from private.protected_documents where id=p_id;select * into a from private.dream_team_applications where id=d.application_id;
 if a.id is null or auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not is_anonymous) or not (auth.uid()=a.user_id or (private.has_staff_permission(a.organization_id,'dream_team.application.read') and private.has_staff_permission(a.organization_id,'dream_team.application.restricted'))) then raise exception 'Document unavailable' using errcode='42501';end if;
 insert into private.dream_team_audit(application_id,actor,action) values(a.id,auth.uid(),'pdf_access');
 return jsonb_build_object('path',d.object_path);
end$$;
create function public.dream_team_document(p_id uuid) returns jsonb language sql set search_path='' as $$select private.dream_team_document(p_id)$$;
-- Worker-only queue claims and receipts. No client may forge delivery or a PDF attachment.
create function private.dream_team_worker(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.dream_team_jobs;a private.dream_team_applications;r jsonb;begin
 if p_action='claim' then
  select * into j from private.dream_team_jobs where status='queued' order by created_at,id for update skip locked limit 1;
  if j.id is null then return null;end if;
  update private.dream_team_jobs set status='processing',lease=gen_random_uuid(),updated_at=now() where id=j.id returning * into j;
  select * into a from private.dream_team_applications where id=j.application_id;
  return to_jsonb(j)||jsonb_build_object('email',(select email from auth.users where id=a.user_id and email_confirmed_at is not null and not is_anonymous),'snapshot',(select snapshot from private.dream_team_submissions where id=j.submission_id),'object_path',a.organization_id||'/'||j.submission_id||'.pdf');
 elsif p_action='receipt' then
  select * into j from private.dream_team_jobs where id=(p_data->>'id')::uuid and lease=(p_data->>'lease')::uuid and status='processing' for update;
  if j.id is null then raise exception 'Stale worker receipt';end if;
  if p_data->>'status' not in('accepted','failed','unknown') then raise exception 'Invalid receipt';end if;
  if j.kind='pdf' and p_data->>'status'='accepted' then
   select * into a from private.dream_team_applications where id=j.application_id;
   insert into private.protected_documents(application_id,submission_id,object_path,sha256) values(a.id,j.submission_id,a.organization_id||'/'||j.submission_id||'.pdf',p_data->>'sha256') on conflict(submission_id) do nothing;
  end if;
  update private.dream_team_jobs set status=p_data->>'status',updated_at=now() where id=j.id;return jsonb_build_object('recorded',true);
 else raise exception 'Unknown worker action';end if;
end$$;
create function public.dream_team_worker(p_action text,p_data jsonb default '{}') returns jsonb language sql set search_path='' as $$select private.dream_team_worker(p_action,p_data)$$;

-- Every new relation is restricted. No browser table grants, even for safe summaries.
do $$declare t text;begin foreach t in array array['dream_team_forms','dream_team_applications','dream_team_submissions','dream_team_audit','domain_events','dream_team_jobs','protected_documents','dream_team_placements'] loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);execute format('grant all on private.%I to service_role',t);
end loop;end$$;
revoke all on function private.dream_team_immutable(),private.dream_team_event(private.dream_team_applications,text,text),private.dream_team_available(uuid,uuid,text),private.dream_team_course_hook(),private.dream_team_validate(jsonb,jsonb,boolean),private.dream_team_summary(private.dream_team_applications) from public,anon,authenticated;
revoke all on function private.dream_team(text,jsonb),public.dream_team(text,jsonb),private.dream_team_admin(uuid,text,jsonb),public.dream_team_admin(uuid,text,jsonb),private.dream_team_person(uuid,uuid),public.dream_team_person(uuid,uuid),private.dream_team_alerts(uuid),public.dream_team_alerts(uuid),private.dream_team_document(uuid),public.dream_team_document(uuid) from public,anon,authenticated;
grant execute on function private.dream_team(text,jsonb),public.dream_team(text,jsonb),private.dream_team_admin(uuid,text,jsonb),public.dream_team_admin(uuid,text,jsonb),private.dream_team_person(uuid,uuid),public.dream_team_person(uuid,uuid),private.dream_team_alerts(uuid),public.dream_team_alerts(uuid),private.dream_team_document(uuid),public.dream_team_document(uuid) to authenticated;
revoke all on function private.dream_team_worker(text,jsonb),public.dream_team_worker(text,jsonb) from public,anon,authenticated;
grant execute on function private.dream_team_worker(text,jsonb),public.dream_team_worker(text,jsonb) to service_role;

-- Managed Storage only; synthetic replay has no storage schema. No browser object policy is created.
do $$begin
 if to_regclass('storage.buckets') is not null then
  if exists(select 1 from storage.buckets where id='dream-team-private' and public) then raise exception 'Dream Team bucket must be private';end if;
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('dream-team-private','dream-team-private',false,10485760,array['application/pdf']) on conflict(id) do nothing;
 end if;
end$$;
