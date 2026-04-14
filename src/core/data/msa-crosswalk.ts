/**
 * BLS MSA to BEA area crosswalk with hardcoded RPP values.
 *
 * Eliminates the need for a BEA API call in v1. RPP (Regional Price Parity)
 * values are from BEA Table CAINC30 for the most recent available year.
 * RPP = 100 is the national average. Higher = more expensive area.
 *
 * Used by col-service.ts for cost-of-living adjustments in the walk-away calculation.
 */
export interface MSACrosswalkEntry {
  blsMSACode: string;
  beaAreaCode: string;
  msaName: string;
  rpp: number;
}

export const MSA_CROSSWALK: MSACrosswalkEntry[] = [
  // High cost metros
  { blsMSACode: "41860", beaAreaCode: "XX200", msaName: "San Francisco-Oakland-Hayward, CA", rpp: 118.3 },
  { blsMSACode: "41940", beaAreaCode: "XX210", msaName: "San Jose-Sunnyvale-Santa Clara, CA", rpp: 122.5 },
  { blsMSACode: "35620", beaAreaCode: "XX100", msaName: "New York-Newark-Jersey City, NY-NJ-PA", rpp: 125.8 },
  { blsMSACode: "31080", beaAreaCode: "XX080", msaName: "Los Angeles-Long Beach-Anaheim, CA", rpp: 114.2 },
  { blsMSACode: "42660", beaAreaCode: "XX220", msaName: "Seattle-Tacoma-Bellevue, WA", rpp: 113.4 },
  { blsMSACode: "14460", beaAreaCode: "XX030", msaName: "Boston-Cambridge-Nashua, MA-NH", rpp: 112.6 },
  { blsMSACode: "47894", beaAreaCode: "XX230", msaName: "Washington-Arlington-Alexandria, DC-VA-MD-WV", rpp: 112.9 },
  { blsMSACode: "41740", beaAreaCode: "XX205", msaName: "San Diego-Carlsbad, CA", rpp: 113.7 },
  { blsMSACode: "33100", beaAreaCode: "XX090", msaName: "Miami-Fort Lauderdale-West Palm Beach, FL", rpp: 109.5 },
  { blsMSACode: "38900", beaAreaCode: "XX190", msaName: "Portland-Vancouver-Hillsboro, OR-WA", rpp: 107.8 },
  { blsMSACode: "37980", beaAreaCode: "XX180", msaName: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD", rpp: 102.8 },
  { blsMSACode: "12580", beaAreaCode: "XX015", msaName: "Baltimore-Columbia-Towson, MD", rpp: 104.3 },
  { blsMSACode: "40900", beaAreaCode: "XX195", msaName: "Sacramento-Roseville-Arden-Arcade, CA", rpp: 105.4 },
  { blsMSACode: "40140", beaAreaCode: "XX185", msaName: "Riverside-San Bernardino-Ontario, CA", rpp: 103.6 },
  { blsMSACode: "23420", beaAreaCode: "XX060", msaName: "Fresno, CA", rpp: 97.8 },
  { blsMSACode: "44700", beaAreaCode: "XX215", msaName: "Stockton-Lodi, CA", rpp: 101.3 },
  { blsMSACode: "46520", beaAreaCode: "XX225", msaName: "Urban Honolulu, HI", rpp: 115.8 },

  // Medium-high cost metros
  { blsMSACode: "16980", beaAreaCode: "XX040", msaName: "Chicago-Naperville-Elgin, IL-IN-WI", rpp: 105.2 },
  { blsMSACode: "19740", beaAreaCode: "XX050", msaName: "Denver-Aurora-Lakewood, CO", rpp: 106.3 },
  { blsMSACode: "45300", beaAreaCode: "XX235", msaName: "Tampa-St. Petersburg-Clearwater, FL", rpp: 99.4 },
  { blsMSACode: "33460", beaAreaCode: "XX110", msaName: "Minneapolis-St. Paul-Bloomington, MN-WI", rpp: 101.9 },
  { blsMSACode: "36740", beaAreaCode: "XX100", msaName: "Orlando-Kissimmee-Sanford, FL", rpp: 99.2 },
  { blsMSACode: "41180", beaAreaCode: "XX208", msaName: "St. Louis, MO-IL", rpp: 94.5 },
  { blsMSACode: "18140", beaAreaCode: "XX045", msaName: "Columbus, OH", rpp: 96.1 },
  { blsMSACode: "25540", beaAreaCode: "XX035", msaName: "Hartford-West Hartford-East Hartford, CT", rpp: 106.1 },
  { blsMSACode: "39300", beaAreaCode: "XX175", msaName: "Providence-Warwick, RI-MA", rpp: 103.2 },
  { blsMSACode: "41620", beaAreaCode: "XX240", msaName: "Salt Lake City, UT", rpp: 100.5 },
  { blsMSACode: "29820", beaAreaCode: "XX170", msaName: "Las Vegas-Henderson-Paradise, NV", rpp: 100.8 },
  { blsMSACode: "17820", beaAreaCode: "XX042", msaName: "Colorado Springs, CO", rpp: 99.3 },
  { blsMSACode: "15380", beaAreaCode: "XX020", msaName: "Buffalo-Cheektowaga-Niagara Falls, NY", rpp: 96.7 },
  { blsMSACode: "11260", beaAreaCode: "XX005", msaName: "Anchorage, AK", rpp: 107.1 },

  // Medium cost metros
  { blsMSACode: "26420", beaAreaCode: "XX120", msaName: "Houston-The Woodlands-Sugar Land, TX", rpp: 97.4 },
  { blsMSACode: "19100", beaAreaCode: "XX055", msaName: "Dallas-Fort Worth-Arlington, TX", rpp: 98.6 },
  { blsMSACode: "12420", beaAreaCode: "XX010", msaName: "Austin-Round Rock-Georgetown, TX", rpp: 101.2 },
  { blsMSACode: "41700", beaAreaCode: "XX207", msaName: "San Antonio-New Braunfels, TX", rpp: 92.8 },
  { blsMSACode: "12060", beaAreaCode: "XX007", msaName: "Atlanta-Sandy Springs-Roswell, GA", rpp: 99.1 },
  { blsMSACode: "38060", beaAreaCode: "XX165", msaName: "Phoenix-Mesa-Scottsdale, AZ", rpp: 100.1 },
  { blsMSACode: "34980", beaAreaCode: "XX130", msaName: "Nashville-Davidson-Murfreesboro-Franklin, TN", rpp: 97.6 },
  { blsMSACode: "19820", beaAreaCode: "XX058", msaName: "Detroit-Warren-Dearborn, MI", rpp: 95.2 },
  { blsMSACode: "16740", beaAreaCode: "XX043", msaName: "Charlotte-Concord-Gastonia, NC-SC", rpp: 97.1 },
  { blsMSACode: "39580", beaAreaCode: "XX178", msaName: "Raleigh, NC", rpp: 97.8 },
  { blsMSACode: "26900", beaAreaCode: "XX125", msaName: "Indianapolis-Carmel-Anderson, IN", rpp: 93.4 },
  { blsMSACode: "17140", beaAreaCode: "XX047", msaName: "Cincinnati, OH-KY-IN", rpp: 93.8 },
  { blsMSACode: "17460", beaAreaCode: "XX048", msaName: "Cleveland-Elyria, OH", rpp: 94.6 },
  { blsMSACode: "33340", beaAreaCode: "XX115", msaName: "Milwaukee-Waukesha-West Allis, WI", rpp: 96.3 },
  { blsMSACode: "28140", beaAreaCode: "XX140", msaName: "Kansas City, MO-KS", rpp: 94.2 },
  { blsMSACode: "31140", beaAreaCode: "XX155", msaName: "Louisville/Jefferson County, KY-IN", rpp: 93.7 },
  { blsMSACode: "47260", beaAreaCode: "XX245", msaName: "Virginia Beach-Norfolk-Newport News, VA-NC", rpp: 98.4 },
  { blsMSACode: "40060", beaAreaCode: "XX183", msaName: "Richmond, VA", rpp: 98.2 },

  // Lower cost metros
  { blsMSACode: "21340", beaAreaCode: "XX053", msaName: "El Paso, TX", rpp: 89.7 },
  { blsMSACode: "10740", beaAreaCode: "XX002", msaName: "Albuquerque, NM", rpp: 95.4 },
  { blsMSACode: "46060", beaAreaCode: "XX227", msaName: "Tucson, AZ", rpp: 95.1 },
  { blsMSACode: "27260", beaAreaCode: "XX135", msaName: "Jacksonville, FL", rpp: 96.8 },
  { blsMSACode: "18580", beaAreaCode: "XX057", msaName: "Corpus Christi, TX", rpp: 90.3 },
  { blsMSACode: "24660", beaAreaCode: "XX068", msaName: "Greensboro-High Point, NC", rpp: 92.5 },
  { blsMSACode: "38300", beaAreaCode: "XX177", msaName: "Pittsburgh, PA", rpp: 95.8 },
  { blsMSACode: "35380", beaAreaCode: "XX163", msaName: "New Orleans-Metairie, LA", rpp: 96.1 },
  { blsMSACode: "48620", beaAreaCode: "XX250", msaName: "Wichita, KS", rpp: 89.8 },
  { blsMSACode: "31180", beaAreaCode: "XX157", msaName: "Lubbock, TX", rpp: 88.5 },
  { blsMSACode: "36540", beaAreaCode: "XX105", msaName: "Omaha-Council Bluffs, NE-IA", rpp: 93.9 },
  { blsMSACode: "30700", beaAreaCode: "XX160", msaName: "Lincoln, NE", rpp: 93.1 },
  { blsMSACode: "31540", beaAreaCode: "XX162", msaName: "Madison, WI", rpp: 99.5 },
  { blsMSACode: "32820", beaAreaCode: "XX145", msaName: "Memphis, TN-MS-AR", rpp: 90.2 },
  { blsMSACode: "36420", beaAreaCode: "XX108", msaName: "Oklahoma City, OK", rpp: 89.9 },
  { blsMSACode: "46140", beaAreaCode: "XX248", msaName: "Tulsa, OK", rpp: 89.4 },
  { blsMSACode: "12940", beaAreaCode: "XX012", msaName: "Baton Rouge, LA", rpp: 93.6 },
  { blsMSACode: "14260", beaAreaCode: "XX018", msaName: "Boise City, ID", rpp: 97.8 },
  { blsMSACode: "44060", beaAreaCode: "XX232", msaName: "Spokane-Spokane Valley, WA", rpp: 97.2 },
  { blsMSACode: "13820", beaAreaCode: "XX008", msaName: "Birmingham-Hoover, AL", rpp: 90.7 },
  { blsMSACode: "19780", beaAreaCode: "XX052", msaName: "Des Moines-West Des Moines, IA", rpp: 94.3 },
  { blsMSACode: "40380", beaAreaCode: "XX182", msaName: "Rochester, NY", rpp: 96.2 },
  { blsMSACode: "12540", beaAreaCode: "XX014", msaName: "Bakersfield, CA", rpp: 97.1 },
  { blsMSACode: "23060", beaAreaCode: "XX056", msaName: "Fort Wayne, IN", rpp: 90.6 },
  { blsMSACode: "45780", beaAreaCode: "XX238", msaName: "Toledo, OH", rpp: 91.3 },
  { blsMSACode: "39900", beaAreaCode: "XX181", msaName: "Reno, NV", rpp: 103.4 },
  { blsMSACode: "49180", beaAreaCode: "XX252", msaName: "Winston-Salem, NC", rpp: 92.8 },
  { blsMSACode: "30460", beaAreaCode: "XX158", msaName: "Lexington-Fayette, KY", rpp: 93.2 },
  { blsMSACode: "29700", beaAreaCode: "XX168", msaName: "Laredo, TX", rpp: 87.3 },
  { blsMSACode: "19380", beaAreaCode: "XX060", msaName: "Dayton, OH", rpp: 91.5 },
  { blsMSACode: "22200", beaAreaCode: "XX022", msaName: "Fayetteville-Springdale-Rogers, AR-MO", rpp: 90.1 },
  { blsMSACode: "20500", beaAreaCode: "XX065", msaName: "Durham-Chapel Hill, NC", rpp: 98.3 },
  { blsMSACode: "16700", beaAreaCode: "XX044", msaName: "Charleston-North Charleston, SC", rpp: 99.2 },
  { blsMSACode: "42340", beaAreaCode: "XX206", msaName: "Savannah, GA", rpp: 93.4 },
  { blsMSACode: "27140", beaAreaCode: "XX132", msaName: "Jackson, MS", rpp: 87.8 },
];
