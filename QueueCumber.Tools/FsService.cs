using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace QueueCumber.Tools
{
    public class FsService
    {

        public string GetAppFolder()
        {

            var ret = "";
            try
            {

                var AppDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                ret = Path.Combine(AppDir, "QueueCumber");

                if (!Directory.Exists(ret))
                {

                    Directory.CreateDirectory(ret);

                }


            }
            catch (Exception ex)
            {

                throw new Exception("Error Creating QueueCumber folder.", ex);


            }
            return ret;

        }


    }
}
