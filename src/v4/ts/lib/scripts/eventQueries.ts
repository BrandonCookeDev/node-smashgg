import * as Schema from './schema'
export const event = `query EventByTournamentSlugQuery($slug:String){
    tournament(slug:$slug){
        id
        name
        slug
        events{
            ${Schema.event}
        }
  	}
}`

export const eventPlayers = `query EventParticipantQuery($slug: String, $eventIds: [Int]) {
    tournament(slug: $slug){
        id
        name
        slug
        participants(query: {
            page: 0,
            perPage: 10000,
            sortBy: "asc",
            filter: {
                eventIds: $eventIds
            }
        },
        isAdmin: false){
            nodes{
                ${Schema.attendee}
            }
        }
    }  
}`

export const eventVideoGame = `query EventVideoGame($slug: String){
    
}`

export const eventWithEverything = `query EventByTournamentSlugQuery($slug:String){
    tournament(slug:$slug){
        id
        events{
            id
            name
            slug
            startAt
          	numEntrants
          	checkInBuffer
          	checkInDuration
          	checkInEnabled
          	teamNameAllowed
          	teamManagementDeadline
          	prizingInfo
          	videogame {
          	  id
              name
              slug
              displayName
          	}
            tournament{
			  id
              name
              slug
              city
              postalCode
              addrState
              countryCode
              region
              venueAddress
              venueName
              gettingThere
              lat
              lng
              timezone
              startAt
              endAt
              contactInfo
              contactEmail
              contactTwitter
              contactPhone
              ownerId
            }
        }
    }
}`