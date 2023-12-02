import 'dotenv/config'
import cld from 'cld'
import * as Minio from 'minio'

const wallabag_clientId: string = process.env.WALLABAG_CLIENT_ID!
const wallabag_clientSecret: string = process.env.WALLABAG_CLIENT_SECRET!
const wallabag_login: string = process.env.WALLABAG_LOGIN!
const wallabag_password: string = process.env.WALLABAG_PASSWORD!
const wallabag_url: sring = process.env.WALLABAG_URL!
const tts_en_url: string = process.env.TTS_EN_URL!

// s3 env vars
const s3_access_key: string = process.env.S3_ACCESS_KEY!
const s3_secret_key: string = process.env.S3_SECRET_KEY!
const s3_endpoint: string = process.env.S3_ENDPOINT!
const s3_bucket: string = process.env.S3_BUCKET!

//Voices
const voice_en_1 : string = process.env.VOICE_EN_1!
const voice_en_2 : string = process.env.VOICE_EN_2!
const voice_en_3 : string = process.env.VOICE_EN_3!

const minioClient = new Minio.Client({
    endPoint: s3_endpoint,
    port: 443,
    useSSL: true,
    accessKey: s3_access_key,
    secretKey: s3_secret_key,
    pathStyle: true
})

function voiceSelector(language: string): string{
    switch(language){
        case "en":
            // return random voice
            let voices = [voice_en_1, voice_en_2, voice_en_3]
            return voices[Math.floor(Math.random() * voices.length)]
        case "fr":
            return voice_en_2
        default:
            return voice_en_1
    }
}

function removeTags(str: string) {
	if ((str===null) || (str===''))
		return false;
	else
		str = str.toString();
		
	// Regular expression to identify HTML tags in
	// the input string. Replacing the identified
	// HTML tag with a null string.
	str = str.replace( /(<([^>]+)>)/ig, '');

    // also remove newlines
    str = str.replace( /\n/g, ' ');
    return str;
}

function splitStringByWords(inputString: string, wordsPerChunk: number) {
    const words = inputString.split(' ');
    const resultArray = [];

    for (let i = 0; i < words.length; i += wordsPerChunk) {
        const chunk = words.slice(i, i + wordsPerChunk);
        resultArray.push(chunk.join(' '));
    }

    return resultArray;
}

function mergeBase64Chunks(base64Chunks: string[]) {
    console.log("merging base64 chunks")
    const binaryChunks = base64Chunks.map(base64Chunk => Buffer.from(base64Chunk, 'base64'));
    const binary = Buffer.concat(binaryChunks);
    const base64 = binary.toString('base64');
    return base64;
}


async function gets3Items() {
    const objectsStream = minioClient.listObjectsV2(s3_bucket, '', true, '');
    const objects: any[] = [];
    for await (const object of objectsStream) {
        objects.push(object);
    }
    return objects;
}

async function createRss(s3Items, articles){
    console.log("creating rss feed")
    let rss = ""
    rss += "<rss version=\"2.0\">\n"
    rss += "<channel>\n"
    rss += "<title>Wallabag to Podcast</title>\n"
    rss += "<link>YOUR_LINK_GOES_HERE</link>\n"  // Replace YOUR_LINK_GOES_HERE with the actual link
    rss += "<description>Wallabag to Podcast</description>\n"
    rss += "<language>en-us</language>\n"
    rss += "<lastBuildDate>" + new Date().toUTCString() + "</lastBuildDate>\n"
    // put 01-12-2023
    rss += "<pubDate>" + new Date("01-12-2023").toUTCString() + "</pubDate>\n"
    //add cover image
    rss += "<image>\n"
    rss += "<url>https://99designs-blog.imgix.net/blog/wp-content/uploads/2018/01/attachment_91327424-e1515420211463.png</url>\n" // Replace YOUR_IMAGE_URL_GOES_HERE with the actual image url
    rss += "<title>Wallabag to Podcast</title>\n"
    rss += "<link></link>\n" // Replace YOUR_LINK_GOES_HERE with the actual link
    rss += "</image>\n"
    for(let article of articles){
        console.log(`article id: ${article.id} - s3Items: ${s3Items} - includes: ${s3Items.includes(article.id.toString())}` )
        if(s3Items.includes(article.id.toString())){
            rss += "<item>\n"
            rss += "<title>" + article.title + "</title>\n"
            rss += `<enclosure url="https://${s3_endpoint}/${s3_bucket}/${article.id}.mp3" length="1" type="audio/mpeg" />\n`
            rss += "<pubDate>" + new Date(article.date).toUTCString() + "</pubDate>\n"
            rss += "<guid>" + article.id + "</guid>\n"
            rss += "</item>\n"
        }
    }
    rss += "</channel>\n"
    rss += "</rss>\n"
    return rss
}


export async function createAudio(){
    console.log("creating audio");

    let request = fetch(wallabag_url + "/oauth/v2/token", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grant_type: "password",
            client_id: wallabag_clientId,
            client_secret: wallabag_clientSecret,
            username: wallabag_login,
            password: wallabag_password
        })
    })
    
    let response = await request
    let token = await response.json()
    token = token.access_token

    // get entries
    request = fetch(wallabag_url + "/api/entries?archive=0", {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    })
    response = await request
    let entries = await response.json()
    let entries_items = entries._embedded.items
    interface Article {
        id: number,
        title: string,
        url: string,
        content: string,
        language?: string,
        date?: string
    }
    let articles: Article[] = []

    for(let entry of entries_items){
        let article: Article = {
            id: entry.id,
            title: entry.title,
            url: entry.url,
            content: entry.content,
            language: "",
            date: entry.created_at
        }
        articles.push(article)
    }


    const s3Items = await gets3Items();
    // s3 items chnage into array of ids
    let s3ItemsIds = s3Items.map(item => item.name.split('.')[0]);

    let rawArticles = articles
    // remove articles that already have audio
    articles = articles.filter(article => !s3ItemsIds.includes(article.id.toString()));

    // remove html tags from content
    articles.map(async (article: Article) => {
        article.content = removeTags(article.content);
    });

    for(let article of articles){
        let language = await cld.detect(article.content)
        article.language = language.languages[0].code
    }

    for(let article of articles){
        if(article.language == "en"){
            console.log("creating audio for article " + article.id)

            // split article into chunks of 1500 characters
            let chunks = splitStringByWords(article.content, 1400)

            let audios = []
            let audio = ""

            for(let chunk of chunks){
                let request = fetch(tts_en_url + "/predictions", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        input: {
                            text: chunk,
                            reference: voiceSelector(article.language)
                        }
                    })
                })
                let response = await request
                audio = await response.json()
                console.log("-------------------audio chunk-----------------")
                //console.log(audio)
                if(audio.status == "succeeded"){
                    audios.push(audio.output)
                }
            }


            //if audios.length > 1 then merge them
            if(audios.length > 1){
                audio = mergeBase64Chunks(audios)
            }
            else{
                console.log("only one audio chunk")
                audio = audios[0]
            }
            
            try{
                // upload to s3 as public file
                let filename = article.id + ".mp3"
                let file = Buffer.from(audio , 'base64')
                await minioClient.putObject(s3_bucket, filename, file, file.length, {
                    'Content-Type': 'audio/mpeg',
                    'x-amz-acl': 'public-read'
                })
                console.log("uploaded file " + filename)
            }
            catch(err){
                console.log(err)
            }
            const s3Items = await gets3Items();
            // s3 items chnage into array of ids
            let s3ItemsIds = s3Items.map(item => item.name.split('.')[0]);
            let rss = await createRss(s3ItemsIds, rawArticles)
            try{
                // upload to s3 as public file
                let filename = "rss.xml"
                let file = Buffer.from(rss , 'utf8')
                await minioClient.putObject(s3_bucket, filename, file, file.length, {
                    'Content-Type': 'application/xml',
                    'x-amz-acl': 'public-read'
                })
                console.log("uploaded file " + filename)

            }
            catch(err){
                console.log(err)
            }
        }
    }


}